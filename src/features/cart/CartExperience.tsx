import { fetchWithSession } from '../../lib/session'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, EmptyState } from '../../components/ui'
import { FashionBagAnimation } from '../../components/FashionBagAnimation'
import { useBusinessConfig } from '../storefront/StorefrontConfig'
import { businessConfig } from '../../config/business'
import { getAccessToken } from '../../lib/session'
import { getGuestCart, removeGuestCartItem, setGuestCartQuantity, guestCartCount } from '../../lib/guest-cart'
import { ExperienceSkeleton } from '../../components/Experience'
import './cart.css'
import { useI18n } from '../../i18n/I18nProvider'
import { QuantityControl } from '../../components/QuantityControl'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type ApiResult<T> = { success: boolean; data?: T; error?: { message?: string } }
type CartItem = { variantId: string; productId?: string; name: string; nameTranslations?:{en?:string;bn?:string}; slug: string; image?: string; color: string; size: string; sku?: string; price: number; compareAtPrice?: number; currency: string; quantity: number; available: number; isAvailable: boolean }
type DeliveryOption = { code: string; label: string; fee: number; freeAbove?: number; estimatedDays?: string; enabled: boolean }
type Quote = { subtotal: number; discountTotal: number; shippingTotal: number; total: number; currency: string; couponCode?: string; deliveryOption: DeliveryOption; items: CartItem[] }

function cartError(cause: unknown, fallback: string, network: string) {
  return cause instanceof TypeError ? network : cause instanceof Error ? cause.message : fallback
}

function businessHeaders(token?: string) {
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
  return headers
}

export default function CartExperience() {
  const { locale, t } = useI18n()
  const { config: storefront } = useBusinessConfig()
  const money = (amount: number, currency?: string) => formatMoney(amount, currency, locale)
  const [token, setToken] = useState('')
  const [items, setItems] = useState<CartItem[]>([])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [deliveryCode, setDeliveryCode] = useState('')
  const selection = useRef({ token: '', couponCode: '', deliveryCode: '' })

  const [couponDraft, setCouponDraft] = useState('')
  const [couponCode, setCouponCode] = useState('')
  selection.current = { token, couponCode, deliveryCode }
  const [currency, setCurrency] = useState(businessConfig.currency)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refreshQuote = useCallback(async (lines: Array<{ variantId: string; quantity: number }>, code = selection.current.couponCode, delivery = selection.current.deliveryCode, access = selection.current.token) => {
    if (!lines.length || !delivery) { setQuote(null); return }
    const response = await fetchWithSession(`${apiBase}/checkout/quote`, {
      method: 'POST', headers: new Headers([...businessHeaders(access), ['Content-Type', 'application/json']]), credentials: 'include',
      body: JSON.stringify({ items: lines.map(({ variantId, quantity }) => ({ variantId, quantity })), deliveryOptionCode: delivery, ...(code ? { couponCode: code } : {}) }),
    })
    const result = await response.json() as ApiResult<Quote>
    if (!response.ok || !result.success || !result.data) throw new Error(result.error?.message || 'Unable to calculate your order total.')
    setQuote(result.data); setCurrency(result.data.currency); setItems(result.data.items)
  }, [])

  const loadCart = useCallback(async (access: string, delivery: string) => {
    const response = await fetchWithSession(`${apiBase}/cart`, { headers: businessHeaders(access), credentials: 'include' })
    const result = await response.json() as ApiResult<{ items: CartItem[] }>
    if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to load your bag.')
    const lines = result.data?.items ?? []
    setItems(lines)
    if (lines.length) await refreshQuote(lines, selection.current.couponCode, delivery, access)
  }, [refreshQuote])

  const loadGuestCart = useCallback(async (delivery: string) => {
    const lines = getGuestCart()
    if (lines.length) await refreshQuote(lines, '', delivery, '')
    else { setItems([]); setQuote(null) }
  }, [refreshQuote])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [configResponse, access] = await Promise.all([
          fetchWithSession(`${apiBase}/checkout/config`, { headers: businessHeaders(), credentials: 'include' }),
          getAccessToken(),
        ])
        const config = await configResponse.json() as ApiResult<{ currency: string; deliveryOptions: DeliveryOption[] }>
        if (!configResponse.ok || !config.success || !config.data) throw new Error('Checkout is not available for this storefront.')
        const options = config.data.deliveryOptions.filter((option) => option.enabled)
        const delivery = options[0]?.code
        if (!delivery) throw new Error('Delivery options are not configured for this storefront.')
        if (!alive) return
        setDeliveryCode(delivery); setCurrency(config.data.currency)
        if (access) { setToken(access); await loadCart(access, delivery) }
        else await loadGuestCart(delivery)
      } catch (cause) { if (alive) setError(cartError(cause, 'Unable to load your bag.', t('cart.networkError'))) }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [loadCart, loadGuestCart, t])

  const update = async (item: CartItem, quantity: number) => {
    setBusyId(item.variantId); setError(''); setNotice('')
    try {
      if (!token) {
        const next = setGuestCartQuantity(item.variantId, quantity)
        if (next.length) await refreshQuote(next)
        else { setItems([]); setQuote(null) }
      } else {
        const response = await fetchWithSession(`${apiBase}/cart/items/${item.variantId}`, { method: 'PATCH', headers: new Headers([...businessHeaders(token), ['Content-Type', 'application/json']]), credentials: 'include', body: JSON.stringify({ quantity }) })
        const result = await response.json() as ApiResult<unknown>
        if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to update this piece.')
        await loadCart(token, deliveryCode)
      }
    } catch (cause) { setError(cartError(cause, 'Unable to update this piece.', t('cart.networkError'))) }
    finally { setBusyId('') }
  }

  const remove = async (item: CartItem) => {
    setBusyId(item.variantId); setError(''); setNotice('')
    try {
      if (!token) {
        const next = removeGuestCartItem(item.variantId)
        if (next.length) await refreshQuote(next)
        else { setItems([]); setQuote(null) }
      } else {
        const response = await fetchWithSession(`${apiBase}/cart/items/${item.variantId}`, { method: 'DELETE', headers: businessHeaders(token), credentials: 'include' })
        const result = await response.json() as ApiResult<unknown>
        if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to remove this piece.')
        await loadCart(token, deliveryCode)
      }
      setNotice(t('delight.bagRemoved', { name: item.name }))
      return true
    } catch (cause) { setError(cartError(cause, 'Unable to remove this piece.', t('cart.networkError')));return false }
    finally { setBusyId('') }
  }

  const moveToWishlist=async(item:CartItem)=>{
    if(!token||!item.productId)return
    setBusyId(item.variantId);setError('')
    try{
      const response=await fetchWithSession(`${apiBase}/users/me/wishlist/${item.productId}`,{method:'POST',headers:businessHeaders(token),credentials:'include'})
      if(!response.ok)throw new Error(t('product.unavailable'))
      if(await remove(item))setNotice(t('product.savedToWishlist'))
    }catch(cause){setError(cartError(cause,t('product.unavailable'),t('cart.networkError')))}finally{setBusyId('')}
  }

  const applyCoupon = async () => {
    setError(''); setNotice('')
    try { await refreshQuote(items.map(({ variantId, quantity }) => ({ variantId, quantity })), couponDraft.trim().toUpperCase()); setCouponCode(couponDraft.trim().toUpperCase()); setNotice(t('delight.totalUpdated')) }
    catch (cause) { setError(cartError(cause, 'That coupon could not be applied.', t('cart.networkError'))) }
  }
  const count = token ? items.reduce((sum, item) => sum + item.quantity, 0) : guestCartCount()
  const quoteMatchesSelection = Boolean(quote && (quote.couponCode || '') === couponCode && !busyId)

  return <main className="cart-page"><header className="account-top"><a href="/" className="account-wordmark">{storefront.name}</a><a className="account-top__link" href="/shop">{t('product.returnCollection')} <span aria-hidden="true">↗</span></a></header><div className="cart-heading"><p className="account-kicker">{t('cart.title')} · {count}</p><h1>{t('cart.title')}</h1><p>{t('cart.intro')}</p></div>{error && <p className="catalog-feedback catalog-feedback--error" role="alert">{error}</p>}{notice && <p className="catalog-feedback" role="status">{notice}</p>}{loading ? <ExperienceSkeleton kind="cart" count={3} /> : items.length ? <div className="cart-layout"><section className="cart-items" aria-label={t('cart.title')}>{items.map((item) => <article className="cart-item" key={item.variantId}><a href={`/products/${item.slug}`} className="cart-item__image">{item.image && <img src={item.image} alt="" loading="lazy" />}</a><div className="cart-item__details"><a href={`/products/${item.slug}`} className="cart-item__name">{locale === 'bn' ? item.nameTranslations?.bn || item.name : item.nameTranslations?.en || item.name}</a><p>{item.color} · {item.size}</p>{item.sku && <p className="cart-item__sku">SKU {item.sku}</p>}{item.isAvailable ? <span className="cart-item__availability">{t('product.inStock')}</span> : <span className="cart-item__unavailable">{t('cart.onlyAvailable', { count: item.available })}</span>}<div className="cart-item__actions"><QuantityControl value={item.quantity} max={Math.max(item.quantity,Math.min(item.available,99))} disabled={busyId===item.variantId} onChange={value=>void update(item,value)}/>{token&&item.productId&&<button className="account-inline-link" disabled={busyId===item.variantId} onClick={()=>void moveToWishlist(item)}>{t('common.wishlist')}</button>}<a className="account-inline-link" href={`/products/${item.slug}`}>{t('cart.changeOptions')}</a><button className="account-inline-link" disabled={busyId === item.variantId} onClick={() => void remove(item)}>{t('cart.remove')}</button></div></div><div className="cart-item__price-wrap"><strong className="cart-item__price">{money(item.price * item.quantity, item.currency)}</strong>{item.compareAtPrice && <del>{money(item.compareAtPrice * item.quantity, item.currency)}</del>}</div></article>)}</section><aside className="cart-summary"><p className="account-kicker">{t('cart.summary')}</p><div className="cart-summary__coupon"><label htmlFor="cart-coupon">{t('cart.coupon')}</label><div><input id="cart-coupon" value={couponDraft} onChange={(event) => setCouponDraft(event.target.value)} autoComplete="off" placeholder={t('cart.enterCoupon')} /><Button variant="secondary" size="sm" disabled={!couponDraft.trim()} onClick={() => void applyCoupon()}>{t('cart.apply')}</Button></div>{couponCode && <button className="account-inline-link" onClick={() => { setCouponCode(''); setCouponDraft(''); void refreshQuote(items.map(({ variantId, quantity }) => ({ variantId, quantity })), '', deliveryCode) }}>{t('cart.remove')} {couponCode}</button>}</div><div><span>{t('cart.subtotal')}</span><strong>{money(quote?.subtotal ?? 0, currency)}</strong></div>{Boolean(quote?.discountTotal) && <div><span>{t('cart.discount')}</span><strong>−{money(quote?.discountTotal ?? 0, currency)}</strong></div>}<div><span>{t('cart.delivery')}</span><strong>{t('delight.deliveryCheckout')}</strong></div><div className="cart-summary__total"><span>{t('delight.beforeDelivery')}</span><strong>{money((quote?.total ?? 0) - (quote?.shippingTotal ?? 0), currency)}</strong></div><small>{t('cart.stockCheck')}</small><Button disabled={!quoteMatchesSelection || items.some((item) => !item.isAvailable)} onClick={() => window.location.assign(couponCode ? `/checkout?couponCode=${encodeURIComponent(couponCode)}` : '/checkout')}>{t('cart.checkout')}</Button><a href="/shop">{t('cart.continueShopping')}</a></aside></div> : <EmptyState title={t('delight.emptyBag')} description={t('cart.emptyText')} illustration={<FashionBagAnimation />} action={<Button onClick={() => window.location.assign('/shop')}>{t('header.collection')}</Button>} />}<footer className="account-footer"><span>© {new Date().getFullYear()} {storefront.name}</span><span>{t('checkout.secure')} · {t('cart.service')}</span></footer></main>
}

function formatMoney(minorUnits: number, code: string | undefined, locale: string) { return new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', { style: 'currency', currency: code || businessConfig.currency }).format(minorUnits / 100) }
