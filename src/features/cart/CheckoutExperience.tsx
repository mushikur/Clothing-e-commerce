import { fetchWithSession } from '../../lib/session'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, EmptyState } from '../../components/ui'
import { businessConfig } from '../../config/business'
import { clearGuestCart, getGuestCart } from '../../lib/guest-cart'
import { getAccessToken } from '../../lib/session'
import { useI18n } from '../../i18n/I18nProvider'
import { localizedDeliveryEta } from '../../i18n/delivery'
import { formatInvoiceAddress, InvoicePrintButton } from '../../components/InvoicePrintButton'
import { useBusinessConfig } from '../storefront/StorefrontConfig'
import { CheckoutProgress, ExperienceSkeleton, SuccessMark } from '../../components/Experience'
import { WalletInstructions, type CollectionDetails } from '../../components/WalletInstructions'
import './checkout.css'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type ApiResult<T> = { success: boolean; data?: T; error?: { message?: string; code?: string; details?: Array<{ path?: string; message?: string }> } }
type CheckoutLine = { variantId: string; productId: string; name: string; nameTranslations?:{en?:string;bn?:string}; slug: string; image?: string; sku: string; color: string; size: string; price: number; compareAtPrice?: number; currency: string; quantity: number; available: number; isAvailable: boolean }
type Address = { _id: string; label?: string; recipientName: string; phone: string; line1: string; line2?: string; city: string; region?: string; division?: string; district?: string; area?: string; deliveryLocationId?: string; deliveryLocationName?: string; deliveryZone?: string; postalCode?: string; countryCode: string; deliveryInstructions?: string; isDefaultShipping: boolean; isDefaultBilling: boolean }
type AddressForm = Omit<Address, '_id' | 'isDefaultShipping' | 'isDefaultBilling'>
type DeliveryOption = { code: string; label: string; labelBn?: string; fee: number; freeAbove?: number; estimatedDays?: string; enabled: boolean }
type PaymentMethod = { code: 'cash_on_delivery' | 'bkash' | 'nagad'; label: string; merchantNumber?: string; accountType?: string; instructions?: string }
type Quote = { items: CheckoutLine[]; subtotal: number; discountTotal: number; shippingTotal: number; total: number; currency: string; couponCode?: string; deliveryOption: DeliveryOption; paymentMethodAware?: boolean }
type OrderConfirmation = { id: string; orderNumber: string; status: string; currency: string; subtotal: number; discountTotal: number; shippingTotal: number; grandTotal: number; createdAt?: string }
type Customer = { name: string; email: string; phone: string }
type PaymentConfirmation = { method: string; status: string; publicInstructions?: string; collectionDetails?: CollectionDetails }
type DeliveryLocation = { _id: string; name: string; nameTranslations?: { en?: string; bn?: string }; division: string; district: string; area: string; zone: 'inside_dhaka' | 'dhaka_nearby' | 'outside_dhaka' }
const blankAddress: AddressForm = { recipientName: '', phone: '', line1: '', line2: '', city: '', region: '', division: '', district: '', area: '', deliveryLocationId: '', deliveryLocationName: '', deliveryZone: '', postalCode: '', countryCode: 'BD', deliveryInstructions: '' }

function headersFor(token?: string) {
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
  return headers
}
function addressKey(address: Pick<AddressForm, 'deliveryLocationId'>) { return address.deliveryLocationId || '' }
const locationStorageKey = `fashion-checkout-location:${import.meta.env.VITE_BUSINESS_SLUG || window.location.host}`
// Remember only the delivery location for this tab; never persist contact or street details.
function rememberedLocation(): Partial<AddressForm> {
  try {
    const location = JSON.parse(sessionStorage.getItem(locationStorageKey) || 'null') as DeliveryLocation | null
    if (!location || !/^[a-f\d]{24}$/i.test(location._id) || ![location.name, location.division, location.district, location.area].every(value => typeof value === 'string' && value.length > 0 && value.length <= 150)) return {}
    return { deliveryLocationId: location._id, deliveryLocationName: location.name, deliveryZone: location.zone, division: location.division, region: location.division, district: location.district, city: location.district, area: location.area }
  } catch { return {} }
}
function rememberLocation(location?: DeliveryLocation) {
  try { if (location) sessionStorage.setItem(locationStorageKey, JSON.stringify(location)); else sessionStorage.removeItem(locationStorageKey) } catch { /* Checkout still works when storage is unavailable. */ }
}
async function calculateQuote(items: Array<{ variantId: string; quantity: number }>, deliveryOptionCode: string, couponCode: string, token: string, address: Pick<AddressForm, 'countryCode' | 'city' | 'region' | 'division' | 'district' | 'area' | 'deliveryLocationId'>, paymentMethod: PaymentMethod['code'] = 'cash_on_delivery') {
  const headers = headersFor(token); headers.set('Content-Type', 'application/json')
  // A quote is needed immediately to show product prices, before the customer
  // has chosen a delivery location. Keep that first request location-neutral;
  // the displayed delivery total is only enabled after a complete location
  // quote succeeds. This also avoids sending empty location fields to APIs or
  // validators that treat blank optional address values as invalid.
  const hasCompleteLocation = Boolean(address.deliveryLocationId?.trim())
  const deliveryAddress = hasCompleteLocation ? {
    countryCode: address.countryCode.trim().toUpperCase(),
    city: address.city?.trim() || address.district?.trim(),
    region: address.region?.trim() || address.division?.trim(),
    division: address.division?.trim(),
    district: address.district?.trim(),
    area: address.area?.trim(),
    deliveryLocationId: address.deliveryLocationId?.trim(),
  } : undefined
  const body = {
    items: items.map(({ variantId, quantity }) => ({ variantId: String(variantId), quantity: Number(quantity) })),
    ...(deliveryOptionCode ? { deliveryOptionCode } : {}),
    ...(deliveryAddress ? { deliveryAddress } : {}),
    paymentMethod,
    ...(couponCode ? { couponCode } : {}),
  }
  const request = (quoteBody: unknown) => fetchWithSession(`${apiBase}/checkout/quote`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify(quoteBody) })
  let response = await request(body)
  let result = await response.json() as ApiResult<Quote>
  const validationDetails = result.error?.details?.map((issue) => `${issue.path || ''} ${issue.message || ''}`).join(' ') || ''
  let paymentMethodAware = true
  // Compatibility for an API process that has not yet picked up the optional
  // payment-aware quote field. Newer APIs keep the method-specific rate; older
  // ones still return the area rate, and order creation remains server-priced.
  if (!response.ok && result.error?.code === 'validation_error' && /unrecognized key/i.test(validationDetails) && /paymentMethod/i.test(validationDetails)) {
    const { paymentMethod: _paymentMethod, ...compatibleBody } = body
    response = await request(compatibleBody)
    result = await response.json() as ApiResult<Quote>
    paymentMethodAware = false
  }
  if (!response.ok || !result.success || !result.data) {
    throw Object.assign(new Error(result.error?.message || 'Unable to confirm current prices, stock, and delivery.'), { code: result.error?.code })
  }
  return { ...result.data, paymentMethodAware }
}
function orderKey() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}` }

export default function CheckoutExperience() {
  const { locale, t } = useI18n()
  const money = (amount: number, currency?: string) => formatMoney(amount, currency, locale)
  const { config: storefront, settings, theme } = useBusinessConfig()
  const bn = locale === 'bn'
  const [items, setItems] = useState<CheckoutLine[]>([])
  const [address, setAddress] = useState<AddressForm>(blankAddress)
  const [locationSearch, setLocationSearch] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<DeliveryLocation[]>([])
  const [locationSearching, setLocationSearching] = useState(false)
  const [locationFocused, setLocationFocused] = useState(false)
  const [saveAddress, setSaveAddress] = useState(false)
  const [customer, setCustomer] = useState<Customer>({ name: '', email: '', phone: '' })
  const [deliveryCode, setDeliveryCode] = useState('')
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [paymentCode, setPaymentCode] = useState<PaymentMethod['code']>('cash_on_delivery')
  const [paymentConfirmation, setPaymentConfirmation] = useState<PaymentConfirmation | null>(null)
  const [guestAccessToken, setGuestAccessToken] = useState('')
  const [guestTransactionId, setGuestTransactionId] = useState('')
  const [guestPaymentSent, setGuestPaymentSent] = useState(false)
  const [couponDraft, setCouponDraft] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLocationKey, setQuoteLocationKey] = useState('')
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [token, setToken] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [directBuy, setDirectBuy] = useState(false)
  const [guestCheckoutEnabled, setGuestCheckoutEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [order, setOrder] = useState<OrderConfirmation | null>(null)
  const confirmationHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (!order) return
    confirmationHeading.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [order?.id])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deliveryError, setDeliveryError] = useState(false)
  const [idempotencyKey] = useState(orderKey)
  const quoteRequestId = useRef(0)
  const quoteDebounce = useRef<number | undefined>(undefined)

  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const selectedPaymentMethod = paymentMethods.find((method) => method.code === (paymentConfirmation?.method || paymentCode))
  const demoPaymentMode = paymentConfirmation?.publicInstructions?.toLowerCase().includes('simulated demo') || false
  const locationComplete = Boolean(address.deliveryLocationId && address.division && address.district && address.area)
  const currentLocationKey = addressKey(address)
  const quoteMatchesLocation = Boolean(locationComplete && quote && quoteLocationKey === currentLocationKey)
  const invoiceBrand = { name: settings.displayName || storefront.name, logoUrl: settings.logoUrl, email: settings.contact?.email, phone: settings.contact?.phone, address: settings.contact?.address, primary: theme?.colors.primary, accent: theme?.colors.accent }
  const invoiceDetails = quote ? {
    number: order?.orderNumber || 'Draft estimate', title: order ? 'Sales invoice' : 'Checkout estimate', status: order?.status.replaceAll('_', ' ') || 'Not yet placed', date: order?.createdAt ? new Date(order.createdAt).toLocaleDateString(bn ? 'bn-BD' : 'en-BD') : new Date().toLocaleDateString(bn ? 'bn-BD' : 'en-BD'), currency: quote.currency,
    customer: { name: customer.name, email: customer.email || undefined, phone: customer.phone },
    address: formatInvoiceAddress([address.line1, address.line2, address.area, address.district, address.division, address.postalCode]),
    payment: selectedPaymentMethod?.label || paymentCode.replaceAll('_', ' '), delivery: quote.deliveryOption.label,
    lines: quote.items.map((item) => ({ name: locale === 'bn' ? item.nameTranslations?.bn || item.name : item.nameTranslations?.en || item.name, sku: item.sku, variant: [item.color, item.size].filter(Boolean).join(' · '), quantity: item.quantity, unitPrice: item.price, total: item.price * item.quantity })),
    subtotal: quote.subtotal, discount: quote.discountTotal, shipping: quote.shippingTotal, total: order?.grandTotal ?? quote.total,
  } : null
  const requestQuote = useCallback(async (nextAddress: AddressForm, coupon = couponCode, payment = paymentCode) => {
    const requestId = ++quoteRequestId.current
    if (!nextAddress.deliveryLocationId || !nextAddress.division || !nextAddress.district || !nextAddress.area || !items.length) {
      setQuoteLocationKey(''); setQuoteLoading(false); setDeliveryError(false); return null
    }
    setQuoteLoading(true); setDeliveryError(false); setError('')
    try {
      const result = await calculateQuote(items.map(({ variantId, quantity }) => ({ variantId, quantity })), deliveryCode, coupon, token, { ...nextAddress, city: nextAddress.district, region: nextAddress.division }, payment)
      if (requestId !== quoteRequestId.current) return null
      setQuote(result); setItems(result.items); setDeliveryCode(result.deliveryOption.code); setQuoteLocationKey(addressKey(nextAddress))
      return result
    } catch (cause) {
      if (requestId !== quoteRequestId.current) return null
      const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : ''
      if (code === 'delivery_unavailable' || code === 'delivery_location_unavailable') { setDeliveryError(true); setQuoteLocationKey('') }
      else setError(cause instanceof Error ? cause.message : (bn ? 'অর্ডারের মূল্য যাচাই করা যায়নি।' : 'We could not update your order total.'))
      return null
    } finally { if (requestId === quoteRequestId.current) setQuoteLoading(false) }
  }, [items, couponCode, paymentCode, deliveryCode, token, bn])

  useEffect(() => {
    const query = locationSearch.trim()
    if (query.length < 2 || address.deliveryLocationId) { setLocationSuggestions([]); setLocationSearching(false); return }
    setLocationSearching(true)
    let active = true
    const timer = window.setTimeout(async () => {
      setLocationSearching(true)
      try {
        const response = await fetchWithSession(`${apiBase}/shipping/locations?q=${encodeURIComponent(query)}`, { headers: headersFor(token), credentials: 'include', cache: 'no-store' })
        const result = await response.json() as ApiResult<{ locations: DeliveryLocation[] }>
        if (active) setLocationSuggestions(response.ok && result.success ? result.data?.locations || [] : [])
      } catch { if (active) setLocationSuggestions([]) }
      finally { if (active) setLocationSearching(false) }
    }, 220)
    return () => { active = false; window.clearTimeout(timer) }
  }, [locationSearch, address.deliveryLocationId, token])

  useEffect(() => () => {
    if (quoteDebounce.current !== undefined) window.clearTimeout(quoteDebounce.current)
    quoteRequestId.current += 1
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const directVariantId = new URLSearchParams(window.location.search).get('buyNow') || ''
        const access = await getAccessToken()
        const [configResponse, userResult, cartResult, addressResult] = await Promise.all([
          fetchWithSession(`${apiBase}/checkout/config`, { headers: headersFor(), credentials: 'include' }),
          access ? fetchWithSession(`${apiBase}/auth/me`, { headers: headersFor(access), credentials: 'include' }).then((response) => response.json() as Promise<ApiResult<{ user: Customer }>>) : Promise.resolve(null),
          access && !directVariantId ? fetchWithSession(`${apiBase}/cart`, { headers: headersFor(access), credentials: 'include' }).then((response) => response.json() as Promise<ApiResult<{ items: CheckoutLine[] }>>) : Promise.resolve(null),
          access ? fetchWithSession(`${apiBase}/users/me/addresses`, { headers: headersFor(access), credentials: 'include' }).then((response) => response.json() as Promise<ApiResult<{ addresses: Address[] }>>) : Promise.resolve(null),
        ])
        const config = await configResponse.json() as ApiResult<{ currency: string; guestCheckoutEnabled: boolean; paymentMethods: PaymentMethod[]; deliveryOptions: DeliveryOption[] }>
        if (!configResponse.ok || !config.success || !config.data) throw new Error('Checkout is not configured for this storefront.')
        const delivery = config.data.deliveryOptions.find((option) => option.enabled)?.code
        if (!delivery) throw new Error('No delivery option is currently available.')
        const profile = userResult?.success ? userResult.data?.user : undefined
        const savedAddresses = addressResult?.success ? addressResult.data?.addresses ?? [] : []
        const direct = Boolean(directVariantId)
        const directQuantity = Number(new URLSearchParams(window.location.search).get('quantity') || 1)
        const cartLines = direct ? [{ variantId: directVariantId, quantity: Number.isInteger(directQuantity) && directQuantity > 0 && directQuantity <= 99 ? directQuantity : 1 }] : cartResult?.success ? cartResult.data?.items ?? [] : getGuestCart()
        if (!cartLines.length) throw new Error('Your bag is empty. Add a piece before continuing.')
        if (access && userResult?.success) { setToken(access); setSignedIn(true) }
        setDirectBuy(direct); setGuestCheckoutEnabled(config.data.guestCheckoutEnabled)
        setPaymentMethods(config.data.paymentMethods)
        const initialPayment = config.data.paymentMethods.some((method) => method.code === 'cash_on_delivery') ? 'cash_on_delivery' : config.data.paymentMethods[0]?.code || 'cash_on_delivery'
        setPaymentCode(initialPayment)
        const initialSaved = savedAddresses.find((item) => item.isDefaultShipping)
        setCustomer({ name: profile?.name || initialSaved?.recipientName || '', email: profile?.email || '', phone: profile?.phone || initialSaved?.phone || '' })
        const remembered = rememberedLocation()
        const initialAddress = { ...(initialSaved ? { ...blankAddress, ...initialSaved, division: initialSaved.division || initialSaved.region || initialSaved.city || '', district: initialSaved.district || initialSaved.city || '', area: initialSaved.area || '' } : blankAddress), ...remembered }
        if (remembered.deliveryLocationId && remembered.deliveryLocationId !== initialSaved?.deliveryLocationId) {
          initialAddress.line1 = ''; initialAddress.line2 = ''
        }
        setAddress(initialAddress); setDeliveryCode(delivery); setItems(cartLines as CheckoutLine[])
        if (initialAddress.deliveryLocationId) setLocationSearch([initialAddress.deliveryLocationName || initialAddress.area, initialAddress.district].filter(Boolean).join(', '))
        let result = await calculateQuote(cartLines.map(({ variantId, quantity }) => ({ variantId: String(variantId), quantity: Number(quantity) })), delivery, '', access || '', { ...initialAddress, city: initialAddress.district || '', region: initialAddress.division || '' }, initialPayment)
        const carriedCoupon = (new URLSearchParams(window.location.search).get('couponCode') || '').trim().toUpperCase()
        if (carriedCoupon && carriedCoupon.length <= 40) {
          try {
            result = await calculateQuote(cartLines.map(({ variantId, quantity }) => ({ variantId: String(variantId), quantity: Number(quantity) })), delivery, carriedCoupon, access || '', { ...initialAddress, city: initialAddress.district || '', region: initialAddress.division || '' }, initialPayment)
            if (alive) { setCouponCode(result.couponCode || ''); setCouponDraft(result.couponCode || '') }
          } catch (cause) { if (alive) setNotice(cause instanceof Error ? cause.message : t('cart.networkError')) }
        }
        if (!alive) return
        setItems(result.items); setQuote(result); setDeliveryCode(result.deliveryOption.code); setError('')
        if (initialAddress.deliveryLocationId) setQuoteLocationKey(addressKey(initialAddress))
      } catch (cause) { if (alive) setError(cause instanceof Error ? cause.message : 'Unable to prepare checkout.') }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  const updateCustomer = (key: keyof Customer, value: string) => setCustomer((current) => ({ ...current, [key]: value }))
  const searchDeliveryLocation = (value: string) => {
    rememberLocation()
    setLocationFocused(true)
    setLocationSearch(value)
    if (address.deliveryLocationId) {
      const next = { ...address, deliveryLocationId: '', deliveryLocationName: '', deliveryZone: '', division: '', region: '', district: '', city: '', area: '' }
      setAddress(next); setQuoteLocationKey(''); setDeliveryError(false); setQuoteLoading(false)
      if (quoteDebounce.current !== undefined) window.clearTimeout(quoteDebounce.current)
      quoteRequestId.current += 1
    }
  }
  const selectDeliveryLocation = (location: DeliveryLocation) => {
    rememberLocation(location)
    const next = { ...address, deliveryLocationId: location._id, deliveryLocationName: location.nameTranslations?.en || location.name, deliveryZone: location.zone, division: location.division, region: location.division, district: location.district, city: location.district, area: location.area }
    setAddress(next); setLocationSearch([bn ? location.nameTranslations?.bn || location.name : location.nameTranslations?.en || location.name, location.district].filter(Boolean).join(', '))
    setLocationSuggestions([]); setLocationFocused(false); setQuoteLocationKey(''); setDeliveryError(false); setError('')
    if (quoteDebounce.current !== undefined) window.clearTimeout(quoteDebounce.current)
    quoteDebounce.current = window.setTimeout(() => { quoteDebounce.current = undefined; void requestQuote(next) }, 120)
  }
  const updateAddress = (key: keyof AddressForm, value: string) => {
    const next = { ...address, [key]: value }
    if (key === 'division') { next.district = ''; next.area = '' }
    if (key === 'district') next.area = ''
    if (key === 'division' || key === 'district' || key === 'area') {
      if (quoteDebounce.current !== undefined) window.clearTimeout(quoteDebounce.current)
      // Invalidate an in-flight quote immediately; it must never replace the
      // charge for the location currently being edited.
      quoteRequestId.current += 1
      setAddress(next)
      setQuoteLocationKey('')
      setDeliveryError(false)
      setError('')
      const complete = Boolean(next.division && next.district && next.area)
      setQuoteLoading(complete)
      if (complete) quoteDebounce.current = window.setTimeout(() => { quoteDebounce.current = undefined; void requestQuote(next) }, 220)
      return
    }
    setAddress(next)
  }
  const applyCoupon = async () => {
    setNotice('')
    const result = await requestQuote(address, couponDraft.trim().toUpperCase())
    if (result) { setCouponCode(result.couponCode || ''); setCouponDraft(result.couponCode || ''); setNotice(bn ? 'কুপন প্রয়োগ করা হয়েছে।' : 'Coupon applied to your order.') }
  }
  const changePayment = (method: PaymentMethod['code']) => { setPaymentCode(method); void requestQuote(address, couponCode, method) }
  const placeOrder = async () => {
    setError(''); setNotice('')
    if (customer.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) { setError(bn ? 'সঠিক ইমেইল ঠিকানা লিখুন।' : 'Enter a valid email address or leave it blank.'); return }
    if (!quoteMatchesLocation || !quote) { setError(bn ? 'অর্ডারের মোট মূল্য যাচাই করুন।' : 'Confirm your order total before placing the order.'); return }
    setPlacing(true)
    try {
      const addressPayload = { recipientName: customer.name.trim(), phone: customer.phone.trim(), line1: address.line1.trim(), city: (address.district || '').trim(), region: (address.division || '').trim(), division: (address.division || '').trim(), district: (address.district || '').trim(), area: (address.area || '').trim(), deliveryLocationId: address.deliveryLocationId, deliveryLocationName: address.deliveryLocationName, deliveryZone: address.deliveryZone, countryCode: 'BD' }
      const body = {
        items: items.map(({ variantId, quantity }) => ({ variantId, quantity })), deliveryOptionCode: deliveryCode, paymentMethod: paymentCode,
        couponCode: couponCode || undefined, address: addressPayload, ...(signedIn && saveAddress ? { saveAddress: true } : {}),
        ...(!signedIn ? { customer: { name: customer.name.trim(), phone: customer.phone.trim(), ...(customer.email.trim() ? { email: customer.email.trim() } : {}) } } : {}),
        clearCart: signedIn && !directBuy, ...(quote.paymentMethodAware !== false ? { expectedTotal: quote.total } : {}), idempotencyKey,
      }
      const headers = headersFor(token); headers.set('Content-Type', 'application/json')
      const response = await fetchWithSession(`${apiBase}/checkout/orders`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify(body) })
      const result = await response.json() as ApiResult<{ order: OrderConfirmation; payment?: PaymentConfirmation; guestAccessToken?: string; reused: boolean }>
      if (!response.ok || !result.success || !result.data?.order) throw new Error(result.error?.message || 'We could not place your order.')
      rememberLocation()
      setOrder(result.data.order); setPaymentConfirmation(result.data.payment || null); setGuestAccessToken(result.data.guestAccessToken || '')
      if (result.data.guestAccessToken) sessionStorage.setItem(`guest-order:${result.data.order.id}`, result.data.guestAccessToken)
      if (directBuy) { window.history.replaceState({}, '', '/checkout'); setDirectBuy(false) }
      if (!signedIn && !directBuy) clearGuestCart()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'We could not place your order.') }
    finally { setPlacing(false) }
  }
  const submitPaymentReference = async () => {
    if (!order?.id || (!signedIn && !guestAccessToken) || (signedIn && !token) || !guestTransactionId.trim()) return
    setError(''); setNotice(''); setPlacing(true)
    try {
      const headers = headersFor(); headers.set('Content-Type', 'application/json')
      if (signedIn) headers.set('Authorization', `Bearer ${token}`)
      const endpoint = signedIn ? `/users/me/orders/${order.id}/payment-reference` : `/checkout/orders/${order.id}/payment-reference`
      const body = { transactionId: guestTransactionId.trim(), ...(!signedIn ? { guestAccessToken } : {}) }
      const response = await fetchWithSession(`${apiBase}${endpoint}`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify(body) })
      const result = await response.json() as ApiResult<{ message: string }>
      if (!response.ok || !result.success) throw new Error(result.error?.message || 'Could not submit this transaction ID.')
      setGuestPaymentSent(true); setPaymentConfirmation((current) => current ? { ...current, status: 'authorized' } : current); setNotice(bn ? 'লেনদেন আইডি যাচাইয়ের জন্য পাঠানো হয়েছে।' : 'Transaction ID submitted for store verification.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit this transaction ID.') }
    finally { setPlacing(false) }
  }

  if (loading) return <main className="checkout-page"><CheckoutHeader backLabel={t('checkout.backToBag')} /><ExperienceSkeleton kind="checkout" count={3} /></main>
  if (error && !items.length) return <main className="checkout-page"><CheckoutHeader backLabel={t('checkout.backToBag')} /><div className="checkout-empty"><EmptyState title={t('checkout.errorTitle')} description={error} action={<Button onClick={() => window.location.assign('/shop')}>{t('header.collection')}</Button>} /></div></main>

  return <main className="checkout-page checkout-page--simple">
    <CheckoutHeader backLabel={t('checkout.backToBag')} />
    <div className="checkout-heading"><p className="account-kicker">{t('checkout.secure')} · {count} {bn ? 'টি পণ্য' : count === 1 ? 'piece' : 'pieces'}</p><h1 ref={confirmationHeading} tabIndex={-1}>{order ? (bn ? 'ধন্যবাদ' : 'Thank you') : (bn ? 'চেকআউট' : 'Checkout')}</h1><p>{order ? (bn ? 'আপনার অর্ডারটি গ্রহণ করা হয়েছে।' : 'Your order has been placed.') : (bn ? 'কয়েকটি তথ্য দিয়ে আপনার অর্ডার সম্পন্ন করুন।' : 'A few details and your order is on its way.')}</p></div>
    {error && <p className="catalog-feedback catalog-feedback--error" role="alert">{error}</p>}{notice && <p className="catalog-feedback" role="status">{notice}</p>}
    <CheckoutProgress complete={Boolean(order)} current={!customer.name.trim() || !customer.phone.trim() ? 0 : !locationComplete || !address.line1.trim() ? 1 : 2} />{order ? <section className="checkout-confirmation"><SuccessMark />
      <p className="account-kicker">{bn ? 'অর্ডার' : 'Order'} {order.orderNumber}</p>
      <h2>{bn ? 'আপনার অর্ডার গ্রহণ করা হয়েছে।' : 'Your order has been received.'}</h2>
      <p>{paymentConfirmation?.method === 'cash_on_delivery' ? (bn ? 'ডেলিভারির সময় পেমেন্ট করুন।' : 'Payment is due on delivery.') : (bn ? 'নিচের Send Money নির্দেশনা অনুসরণ করে ট্রানজ্যাকশন আইডি দিন।' : 'Follow the Send Money instructions below, then submit your transaction ID.')}</p>
      <div className="checkout-confirmation__details">
        <p><span>{bn ? 'অর্ডারের অবস্থা' : 'Order status'}</span><strong>{t(`order.${order.status}`)}</strong></p>
        <p><span>{bn ? 'পেমেন্ট' : 'Payment'}</span><strong>{paymentConfirmation?.method === 'cash_on_delivery' ? (bn ? 'ক্যাশ অন ডেলিভারি' : 'Cash on delivery') : paymentConfirmation?.method || 'Payment pending'}</strong></p>
        <p><span>{bn ? 'ডেলিভারির ঠিকানা' : 'Delivery address'}</span><strong>{[...new Set([customer.name, customer.phone, address.line1, address.area, address.district, address.division].filter(Boolean))].join(', ')}</strong></p>
        <p><span>{t('cart.delivery')}</span><strong>{money(order.shippingTotal, order.currency)}</strong></p>
        {quote?.deliveryOption.estimatedDays && <p><span>{t('invoiceUI.estimatedDelivery')}</span><strong>{localizedDeliveryEta(quote.deliveryOption.estimatedDays, bn)}</strong></p>}
      </div>
      <div className="checkout-confirmation__items">{items.map((item) => <article className="checkout-line" key={item.variantId}><img src={item.image} alt="" /><div><strong>{locale === 'bn' ? item.nameTranslations?.bn || item.name : item.nameTranslations?.en || item.name}</strong><span>{item.color} · {item.size} · {locale === 'bn' ? 'পরিমাণ' : 'Qty'} {item.quantity}</span></div><strong>{money(item.price * item.quantity, item.currency)}</strong></article>)}</div>
      <div className="checkout-confirmation__total"><span>{bn ? 'সর্বমোট' : 'Order total'}</span><strong>{money(order.grandTotal, order.currency)}</strong></div>
      {invoiceDetails && <InvoicePrintButton invoice={invoiceDetails} brand={invoiceBrand} locale={locale} label={bn ? 'ইনভয়েস প্রিন্ট করুন' : 'Print invoice'} />}
      {paymentConfirmation && ['bkash','nagad'].includes(paymentConfirmation.method) && <div className="checkout-payment-instructions">
        <WalletInstructions provider={paymentConfirmation.method as 'bkash'|'nagad'} details={paymentConfirmation.collectionDetails || selectedPaymentMethod} amount={money(order.grandTotal, order.currency)} confirmed reference={order.orderNumber} demo={demoPaymentMode}/>
        {((signedIn && token) || (!signedIn && guestAccessToken)) && !guestPaymentSent && <form className="checkout-guest-payment" onSubmit={(event) => { event.preventDefault(); void submitPaymentReference() }}>
          <label htmlFor="checkout-transaction-id">{bn ? 'ট্রানজ্যাকশন আইডি' : 'Transaction ID'}</label>
          <input id="checkout-transaction-id" required minLength={3} maxLength={120} value={guestTransactionId} onChange={(event) => setGuestTransactionId(event.target.value)} autoComplete="off" />
          <Button disabled={placing || !guestTransactionId.trim()}>{placing ? (bn ? 'পাঠানো হচ্ছে…' : 'Submitting…') : (bn ? 'যাচাইয়ের জন্য পাঠান' : 'Submit for verification')}</Button>
        </form>}
        {guestPaymentSent && <p role="status">{bn ? 'লেনদেন আইডি পাঠানো হয়েছে। স্টোর যাচাই করার পর পেমেন্ট নিশ্চিত হবে।' : 'Transaction ID submitted. The store will verify it before confirming payment.'}</p>}
      </div>}
      <Button onClick={() => window.location.assign(`/orders/${order.id}`)}>{bn ? 'অর্ডার দেখুন' : 'View order'}</Button><a href="/shop">{bn ? 'কেনাকাটা চালিয়ে যান' : 'Continue shopping'}</a>
    </section> : <div className="checkout-layout checkout-layout--simple">
      <section className="checkout-main">
        {!signedIn && !guestCheckoutEnabled && <p className="catalog-feedback">{bn ? 'অতিথি চেকআউট চালু নেই।' : 'Guest checkout is unavailable.'} <a href="/account/sign-in">{t('account.signIn')}</a></p>}
        <section className="checkout-panel" aria-labelledby="checkout-customer-title"><div className="checkout-panel__heading"><span>01</span><div><h2 id="checkout-customer-title">{bn ? 'আপনার তথ্য' : 'Your details'}</h2><p>{bn ? 'অর্ডার পৌঁছাতে আপনার সাথে যোগাযোগের জন্য' : 'So the courier can reach you about your order.'}</p></div></div><div className="checkout-fields checkout-fields--customer"><TextField label={bn ? 'পুরো নাম' : 'Full name'} value={customer.name} required autoComplete="name" onChange={(value) => updateCustomer('name', value)} /><TextField label={bn ? 'ফোন নম্বর' : 'Phone number'} type="tel" value={customer.phone} required autoComplete="tel" onChange={(value) => updateCustomer('phone', value)} /><TextField label={<>{bn ? 'ইমেইল' : 'Email'} <small>({bn ? 'ঐচ্ছিক' : 'Optional'})</small></>} type="email" value={customer.email} autoComplete="email" onChange={(value) => updateCustomer('email', value)} /></div>{!signedIn && <a className="checkout-login-link" href="/account/sign-in">{t('checkout.guestSignIn')}</a>}</section>
        <section className="checkout-panel" aria-labelledby="checkout-address-title"><div className="checkout-panel__heading"><span>02</span><div><h2 id="checkout-address-title">{bn ? 'ডেলিভারির ঠিকানা' : 'Delivery address'}</h2><p>{bn ? 'আপনার ঠিকানা অনুযায়ী চার্জ স্বয়ংক্রিয়ভাবে হিসাব হবে।' : 'Your delivery charge updates automatically for this location.'}</p></div></div><div className="checkout-fields checkout-fields--location"><div className="checkout-location-search"><label className="checkout-input" htmlFor="checkout-location"><span>{bn ? 'বিভাগ, জেলা বা এলাকা' : 'Division, district or area'} <b aria-hidden="true">*</b></span><input id="checkout-location" required role="combobox" aria-autocomplete="list" aria-expanded={locationFocused && locationSearch.trim().length >= 2} aria-controls="checkout-location-options" autoComplete="shipping address-level2" value={locationSearch} placeholder={bn ? 'আপনার এলাকা লিখুন, যেমন মিরপুর' : 'Search your area, for example Mirpur'} onFocus={() => setLocationFocused(true)} onBlur={() => window.setTimeout(() => setLocationFocused(false), 120)} onChange={(event) => searchDeliveryLocation(event.target.value)} onKeyDown={(event) => { if (event.key === 'ArrowDown' && locationSuggestions.length) { event.preventDefault(); (document.querySelector<HTMLButtonElement>('#checkout-location-options button'))?.focus() } else if (event.key === 'Escape') setLocationFocused(false) }} /></label>{locationFocused && locationSearch.trim().length >= 2 && <div className="checkout-location-popover" id="checkout-location-options" role="listbox">{locationSearching ? <p>{bn ? 'খোঁজা হচ্ছে…' : 'Searching locations…'}</p> : locationSuggestions.length ? locationSuggestions.map((location) => <button type="button" role="option" aria-selected={address.deliveryLocationId === location._id} key={location._id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectDeliveryLocation(location)}><strong>{bn ? location.nameTranslations?.bn || location.name : location.nameTranslations?.en || location.name}</strong><small>{bn ? (divisionBn(location.division) + ' বিভাগ · ' + location.district) : (location.area + ', ' + location.district + ', ' + location.division)}</small></button>) : <p>{bn ? 'কোনো এলাকা পাওয়া যায়নি। অন্যভাবে লিখে দেখুন।' : 'No matching locations. Try another spelling.'}</p>}</div>}</div><label className="checkout-input checkout-input--full"><span>{bn ? 'সম্পূর্ণ ঠিকানা' : 'Full address'} <b aria-hidden="true">*</b></span><textarea rows={3} required maxLength={160} value={address.line1} autoComplete="shipping street-address" placeholder={bn ? 'বাড়ি, রোড, এলাকা বা কাছের পরিচিত স্থান' : 'House, road, neighborhood or nearby landmark'} onChange={(event) => updateAddress('line1', event.target.value)} /></label></div>{signedIn && <label className="checkout-save-address"><input type="checkbox" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)} /> {bn ? 'এই ঠিকানাটি আমার অ্যাকাউন্টে সংরক্ষণ করুন' : 'Save this address to my account'}</label>}<div className={`checkout-delivery-status${deliveryError ? ' is-error' : ''}`} role="status" aria-live="polite"><span>{bn ? 'ডেলিভারি' : 'Delivery'}</span>{quoteLoading ? <strong>{bn ? 'হিসাব হচ্ছে…' : 'Calculating…'}</strong> : deliveryError ? <strong>{bn ? 'দুঃখিত, এই এলাকায় আপাতত ডেলিভারি নেই।' : 'Sorry, delivery is currently unavailable in this area.'}</strong> : quoteMatchesLocation ? <><strong>{money(quote?.shippingTotal ?? 0, quote?.currency || businessConfig.currency)}</strong>{quote?.deliveryOption.estimatedDays && <small>{localizedDeliveryEta(quote.deliveryOption.estimatedDays, bn)}</small>}</> : <small>{bn ? 'এলাকা নির্বাচন করলে চার্জ দেখানো হবে' : 'Select your location to see the delivery charge'}</small>}</div></section>
        {paymentMethods.length > 0 && <section className="checkout-panel" aria-labelledby="checkout-payment-title"><div className="checkout-panel__heading"><span>03</span><div><h2 id="checkout-payment-title">{bn ? 'পেমেন্ট' : 'Payment'}</h2><p>{bn ? 'আপনার সুবিধামতো পেমেন্ট পদ্ধতি বেছে নিন।' : 'Choose an available payment method.'}</p></div></div><fieldset className="checkout-radio-list"><legend className="sr-only">{bn ? 'পেমেন্ট পদ্ধতি' : 'Payment method'}</legend>{paymentMethods.map((method) => <label className="checkout-radio-option" key={method.code}><input type="radio" name="payment" checked={paymentCode === method.code} onChange={() => changePayment(method.code)} /><span><strong>{method.code === 'cash_on_delivery' ? (bn ? 'ক্যাশ অন ডেলিভারি' : 'Cash on delivery') : `${method.label} · ${t(method.accountType?.toLowerCase()==='merchant'?'guides.payment':'guides.sendMoney')}`}</strong><small>{method.code === 'cash_on_delivery' ? (bn ? 'পণ্য হাতে পেয়ে পেমেন্ট করুন' : 'Pay when your order arrives.') : (bn ? 'অর্ডারের পর সঠিক পরিমাণ পাঠিয়ে ট্রানজ্যাকশন আইডি দিন।' : 'Send the exact total after placing your order, then submit the transaction ID.')}</small></span></label>)}</fieldset>{selectedPaymentMethod && (paymentCode==='bkash'||paymentCode==='nagad') && <WalletInstructions key={paymentCode} provider={paymentCode} details={selectedPaymentMethod} amount={quoteMatchesLocation&&!quoteLoading&&quote?money(quote.total,quote.currency):undefined}/>}</section>}
        <details className="checkout-coupon checkout-coupon--simple" open={Boolean(couponCode)}><summary>{bn ? 'কুপন কোড আছে?' : 'Have a coupon code?'}</summary><div><label className="sr-only" htmlFor="checkout-coupon">{bn ? 'কুপন কোড' : 'Coupon code'}</label><input id="checkout-coupon" value={couponDraft} onChange={(event) => setCouponDraft(event.target.value)} placeholder={bn ? 'কোড লিখুন' : 'Enter code'} autoComplete="off" /><Button type="button" variant="secondary" size="sm" disabled={!couponDraft.trim() || quoteLoading} onClick={() => void applyCoupon()}>{bn ? 'প্রয়োগ' : 'Apply'}</Button></div>{couponCode && <button type="button" className="account-inline-link" onClick={() => { setCouponCode(''); setCouponDraft(''); void requestQuote(address, '') }}>{bn ? `কুপন ${couponCode} সরান` : `Remove ${couponCode}`}</button>}</details>
        {!paymentMethods.length && <p className="catalog-feedback catalog-feedback--error">{t('checkout.noPayment')}</p>}
      </section>
      <aside className="checkout-summary checkout-summary--simple" aria-label={bn ? 'অর্ডারের সারাংশ' : 'Order summary'}><p className="account-kicker">{bn ? `আপনার ব্যাগ · ${count} টি পণ্য` : `Your bag · ${count} ${count === 1 ? 'piece' : 'pieces'}`}</p>{items.map((item) => <div className="checkout-line" key={item.variantId}><img src={item.image} alt="" loading="lazy" /><div><strong>{locale === 'bn' ? item.nameTranslations?.bn || item.name : item.nameTranslations?.en || item.name}</strong><span>{item.color} · {item.size} · {locale === 'bn' ? 'পরিমাণ' : 'Qty'} {item.quantity}</span></div><strong>{money(item.price * item.quantity, item.currency)}</strong></div>)}<div className="checkout-total"><span>{bn ? 'সাবটোটাল' : 'Subtotal'}</span><strong>{money(quote?.subtotal ?? 0, quote?.currency || businessConfig.currency)}</strong></div>{Boolean(quote?.discountTotal) && <div className="checkout-total"><span>{bn ? 'ছাড়' : 'Discount'}</span><strong>−{money(quote?.discountTotal ?? 0, quote?.currency || businessConfig.currency)}</strong></div>}<div className="checkout-total"><span>{bn ? 'ডেলিভারি' : 'Delivery'}</span><strong>{quoteMatchesLocation ? money(quote?.shippingTotal ?? 0, quote?.currency || businessConfig.currency) : '—'}</strong></div><div className="checkout-total checkout-total--grand"><span>{bn ? 'সর্বমোট' : 'Total'}</span><strong>{quoteMatchesLocation ? money(quote?.total ?? 0, quote?.currency || businessConfig.currency) : '—'}</strong></div>{couponCode && <small>{bn ? `কুপন ${couponCode} প্রয়োগ হয়েছে` : `Coupon ${couponCode} applied`}</small>}{quoteMatchesLocation && invoiceDetails && customer.name.trim() && customer.phone.trim() && address.line1.trim() && <InvoicePrintButton invoice={invoiceDetails} brand={invoiceBrand} locale={locale} label={bn ? 'অর্ডারের আগে ইনভয়েস প্রিন্ট' : 'Print estimate before ordering'} />}<Button className="checkout-place-order" disabled={placing || quoteLoading || deliveryError || !quoteMatchesLocation || !locationComplete || !customer.name.trim() || !customer.phone.trim() || !address.line1.trim() || !paymentMethods.length || (!signedIn && !guestCheckoutEnabled)} onClick={() => void placeOrder()}>{placing ? t('checkout.placing') : t('checkout.placeOrder')}</Button>{!quoteMatchesLocation && <small className="checkout-secure-note" role="status">{t('checkout.deliveryQuoteHint')}</small>}<small className="checkout-secure-note">{bn ? 'আপনার মূল্য ও স্টক অর্ডারের আগে আবার যাচাই করা হবে।' : 'Prices, stock and delivery are verified securely when you order.'}</small></aside>
    </div>}
    <footer className="account-footer"><span>© {new Date().getFullYear()} {businessConfig.name}</span><span>{t('checkout.secure')}</span></footer>
  </main>
}

function CheckoutHeader({ backLabel }: { backLabel: string }) { return <header className="account-top"><a href="/" className="account-wordmark">{businessConfig.name}</a><a className="account-top__link" href="/cart">{backLabel} <span aria-hidden="true">↗</span></a></header> }
function TextField({ label, value, onChange, type = 'text', required = false, autoComplete, minLength, maxLength, placeholder, disabled, list, options }: { label: ReactNode; value: string; onChange: (value: string) => void; type?: string; required?: boolean; autoComplete?: string; minLength?: number; maxLength?: number; placeholder?: string; disabled?: boolean; list?: string; options?: string[] }) { return <label className="checkout-input"><span>{label}</span><input type={type} value={value} required={required} autoComplete={autoComplete} minLength={minLength} maxLength={maxLength} placeholder={placeholder} disabled={disabled} list={list} onChange={(event) => onChange(event.target.value)} />{list && <datalist id={list}>{options?.map((option) => <option key={option} value={option} />)}</datalist>}</label> }
function formatMoney(value: number, currency: string | undefined, locale: string) { return new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', { style: 'currency', currency: currency || businessConfig.currency || 'BDT' }).format(value / 100) }
function divisionBn(division: string) { return ({ Dhaka: 'ঢাকা', Chattogram: 'চট্টগ্রাম', Rajshahi: 'রাজশাহী', Khulna: 'খুলনা', Barishal: 'বরিশাল', Sylhet: 'সিলেট', Rangpur: 'রংপুর', Mymensingh: 'ময়মনসিংহ' } as Record<string, string>)[division] || division }
