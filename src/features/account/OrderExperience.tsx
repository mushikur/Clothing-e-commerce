import { WalletInstructions, type CollectionDetails } from '../../components/WalletInstructions'
import { fetchWithSession } from '../../lib/session'
import { useCallback, useEffect, useState } from 'react'
import { ExperienceSkeleton, SuccessMark } from '../../components/Experience'
import { Button, EmptyState } from '../../components/ui'
import { getAccessToken } from '../../lib/session'
import { useI18n } from '../../i18n/I18nProvider'
import { localizedDeliveryEta } from '../../i18n/delivery'
import { formatInvoiceAddress, InvoicePrintButton } from '../../components/InvoicePrintButton'
import { useBusinessConfig } from '../storefront/StorefrontConfig'
import './orders.css'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type ApiResult<T> = { success: boolean; data?: T; error?: { message?: string } }
type TimelineEntry = { status: string; note?: string; occurredAt: string }
type OrderRecord = { _id: string; orderNumber: string; status: string; currency: string; customer?: { name: string; email?: string; phone?: string }; subtotal: number; discountTotal: number; shippingTotal: number; taxTotal: number; grandTotal: number; deliverySnapshot?: { name?: string; nameTranslations?: { en?: string; bn?: string }; estimatedDelivery?: string; method?: string }; placedAt?: string; notes?:string; billingAddress?:{line1?:string;line2?:string;area?:string;district?:string;division?:string;postalCode?:string;countryCode?:string}; timeline?: TimelineEntry[]; returnRequest?: { status?: string; reason?: string; resolutionNote?: string }; shippingAddress: { recipientName: string; phone?: string; line1: string; line2?: string; city: string; region?: string; division?: string; district?: string; area?: string; postalCode?: string; countryCode: string } }
type OrderItem = { _id: string; productNameSnapshot: string; productNameTranslations?: { en?: string; bn?: string }; skuSnapshot: string; attributesSnapshot?: Record<string, string>; unitPrice: number; quantity: number; discountAmount: number; lineTotal: number }
type Payment = { provider: string; amount: number; currency: string; status: string; customerReference?: string; publicInstructions?: string; collectionDetails?: CollectionDetails; verifiedAt?: string }
type Shipment = { provider: string; trackingMode?: 'real' | 'manual' | 'simulated'; status: string; trackingNumber?: string; trackingUrl?: string; events: Array<{ code: string; description?: string; occurredAt: string; location?: string }>; bookedAt?: string; deliveredAt?: string; updatedAt?: string; returnShipment?: { provider: string; status: string; trackingNumber?: string; trackingUrl?: string; limitation?: string; events?: Array<{ code: string; description?: string; occurredAt: string; location?: string }> } }

export default function OrderExperience({ trackingOnly = false }: { trackingOnly?: boolean }) {
  const { locale, t } = useI18n()
  const { config: storefront, settings, theme } = useBusinessConfig()
  const orderId = window.location.pathname.split('/').filter(Boolean).at(-1) || ''
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [trackingEnabled, setTrackingEnabled] = useState(true)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [accessToken, setAccessToken] = useState('')
  const [guestOrderToken, setGuestOrderToken] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [returnReason, setReturnReason] = useState('')
  const [returnDetails, setReturnDetails] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const invoiceBrand = { name: settings.displayName || storefront.name, logoUrl: settings.logoUrl, email: settings.contact?.email, phone: settings.contact?.phone, address: settings.contact?.address, primary: theme?.colors.primary, accent: theme?.colors.accent }
  const invoiceDetails = order && !trackingOnly ? {
    number: order.orderNumber, title: 'Sales invoice', status: order.status.replaceAll('_', ' '), date: order.placedAt ? new Date(order.placedAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-BD') : undefined,
    currency: order.currency, customer: { name: order.customer?.name || order.shippingAddress.recipientName, email: order.customer?.email, phone: order.customer?.phone || order.shippingAddress.phone },
    address: formatInvoiceAddress([order.shippingAddress.line1, order.shippingAddress.line2, order.shippingAddress.area, order.shippingAddress.district, order.shippingAddress.division, order.shippingAddress.postalCode, order.shippingAddress.countryCode]),
    billingAddress:formatInvoiceAddress([order.billingAddress?.line1,order.billingAddress?.line2,order.billingAddress?.area,order.billingAddress?.district,order.billingAddress?.division,order.billingAddress?.postalCode,order.billingAddress?.countryCode]),notes:order.notes,courier:shipment?.provider,trackingNumber:shipment?.trackingNumber,paymentStatus:payment?.status,payment: payment ? pretty(payment.provider) : undefined, delivery: order.deliverySnapshot?.name,
    lines: items.map((item) => ({ name: (locale === 'bn' ? item.productNameTranslations?.bn : item.productNameTranslations?.en) || item.productNameSnapshot, sku: item.skuSnapshot, variant: Object.values(item.attributesSnapshot || {}).join(' · '), quantity: item.quantity, unitPrice: item.unitPrice, total:item.lineTotal,discount:item.discountAmount })),
    subtotal: order.subtotal, discount: order.discountTotal, shipping: order.shippingTotal, tax: order.taxTotal, total: order.grandTotal,
  } : null

  const refresh = useCallback(async () => {
    const token = await getAccessToken()
    const savedGuestToken = sessionStorage.getItem(`guest-order:${orderId}`) || ''
    if (!token && !savedGuestToken) throw new Error('auth_required')
    const authHeaders = new Headers()
    if (token) authHeaders.set('Authorization', `Bearer ${token}`)
    if (!token && savedGuestToken) authHeaders.set('X-Guest-Order-Token', savedGuestToken)
    if (import.meta.env.VITE_BUSINESS_SLUG) authHeaders.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    const endpoint = token ? (trackingOnly ? `/users/me/orders/${orderId}/tracking` : `/users/me/orders/${orderId}`) : `/checkout/orders/${orderId}/guest`
    const response = await fetchWithSession(`${apiBase}${endpoint}`, { headers: authHeaders, credentials: 'include' })
    const result = await response.json() as ApiResult<{ order: OrderRecord; items?: OrderItem[]; shipment: Shipment | null; payment?: Payment | null; trackingEnabled?: boolean }>
    if (!response.ok || !result.success || !result.data) throw new Error(response.status === 401 ? 'auth_required' : result.error?.message || 'This order could not be found.')
    setAccessToken(token || ''); setGuestOrderToken(token ? '' : savedGuestToken); setOrder(result.data.order); setItems(result.data.items ?? []); setShipment(result.data.shipment); setPayment(result.data.payment ?? null); setTrackingEnabled(result.data.trackingEnabled !== false)
    setTransactionId(result.data.payment?.customerReference || '')
  }, [orderId, trackingOnly])

  useEffect(() => {
    let alive = true
    refresh().catch((cause: unknown) => { if (alive) setError(cause instanceof Error ? cause.message : 'Unable to load order details.') }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [refresh])

  const submit = async (endpoint: string, body: object, successText: string) => {
    setBusy(true); setError(''); setNotice('')
    try {
      const guestPayment = !accessToken && Boolean(guestOrderToken) && endpoint.includes('/payment-reference')
      const headers = new Headers({ ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), 'Content-Type': 'application/json' })
      if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
      const target = guestPayment ? `/checkout/orders/${orderId}/payment-reference` : endpoint
      const payload = guestPayment ? { ...body, guestAccessToken: guestOrderToken } : body
      const response = await fetchWithSession(`${apiBase}${target}`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify(payload) })
      const result = await response.json() as ApiResult<unknown>
      if (!response.ok || !result.success) throw new Error(result.error?.message || 'This update could not be saved.')
      setNotice(successText); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'This update could not be saved.') }
    finally { setBusy(false) }
  }

  return <section className="order-page" aria-labelledby="order-title">
    <header className="account-top"><a href="/" className="account-wordmark">{storefront.name}</a><a className="account-top__link" href="/account?section=Orders">{locale === 'bn' ? 'সব অর্ডার' : 'All orders'} <span aria-hidden="true">↗</span></a></header>
    <div className="order-heading"><p className="account-kicker">{trackingOnly ? (locale === 'bn' ? 'ডেলিভারি আপডেট' : 'Delivery updates') : (locale === 'bn' ? 'অর্ডারের বিস্তারিত' : 'Order details')}</p><h1 id="order-title">{order ? order.orderNumber : (locale === 'bn' ? 'আপনার অর্ডার' : 'Your order')}</h1>{order && <p>{statusLabel(order.status, t)} · {order.placedAt ? new Date(order.placedAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-BD') : (locale === 'bn' ? 'তারিখ পাওয়া যায়নি' : 'Date unavailable')}</p>}{invoiceDetails && <InvoicePrintButton invoice={invoiceDetails} brand={invoiceBrand} locale={locale} label={locale === 'bn' ? 'ইনভয়েস প্রিন্ট করুন' : 'Print invoice'} />}</div>
    {loading ? <ExperienceSkeleton kind="order" count={3} /> : !order ? <EmptyState title={locale === 'bn' ? 'অর্ডারের বিস্তারিত পাওয়া যায়নি' : 'Order details unavailable'} description={error === 'auth_required' ? (locale === 'bn' ? 'এই অর্ডার দেখতে সাইন ইন করুন, অথবা অর্ডার নিশ্চিতকরণের পৃষ্ঠা থেকে খুলুন।' : 'Sign in to view this order, or open it from your order confirmation.'): (locale === 'bn' ? 'অর্ডারটি লোড করা যায়নি। আপনার অর্ডারের তালিকা থেকে আবার চেষ্টা করুন।' : 'We could not load this order. Please try again from your order list.')} action={<Button onClick={() => window.location.assign(error === 'auth_required' ? '/account/sign-in' : '/account?section=Orders')}>{error === 'auth_required' ? t('account.signIn') : (locale === 'bn' ? 'অর্ডারে ফিরে যান' : 'Return to orders')}</Button>} /> : <>
      {error && <p className="catalog-feedback catalog-feedback--error" role="alert">{error}</p>}{notice && <div className="order-success-feedback" role="status"><SuccessMark /><p>{notice}</p></div>}
      {trackingOnly ? !trackingEnabled ? <section className="order-panel"><h2>{t('delight.unavailableTracking')}</h2><p>{t('delight.unavailableTrackingHelp')}</p></section> : <div className="order-layout">
        <section className="order-panel"><p className="account-kicker">{locale === 'bn' ? 'ডেলিভারির অবস্থা' : 'Delivery status'}</p>
          {shipment ? <>{shipment.trackingMode === 'simulated' && <p className="order-demo-tracking"><strong>{t('orderUI.demo')}</strong> {t('orderUI.demoNote')}</p>}<h2>{statusLabel(shipment.status, t)}</h2><p>{shipment.provider}{shipment.trackingNumber ? ` · ${shipment.trackingNumber}` : ''}</p>
            {shipment.trackingUrl && safeUrl(shipment.trackingUrl) && <a className="link-arrow" href={shipment.trackingUrl} target="_blank" rel="noreferrer">{locale === 'bn' ? 'কুরিয়ার ট্র্যাকিং খুলুন' : 'Open carrier tracking'} <span aria-hidden="true">↗</span></a>}
            {shipment.events?.length ? <ol className="tracking-events">{[...shipment.events].sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt)).map((event, index) => <li key={`${event.code}-${event.occurredAt}`} className={index === 0 ? 'is-current' : ''}><span className="tracking-events__dot" /><div><strong>{event.description || statusLabel(event.code, t)}</strong><span>{[event.location, new Date(event.occurredAt).toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-BD')].filter(Boolean).join(' · ')}</span></div></li>)}</ol> : <p>{locale === 'bn' ? 'শিপমেন্ট তৈরি হলে কুরিয়ারের আপডেট এখানে দেখা যাবে।' : 'Carrier updates will appear here when a shipment is created.'}</p>}
            {shipment.returnShipment?.provider && shipment.returnShipment?.status && <section className="order-return-tracking"><p className="account-kicker">{t('orderUI.returnShipment')} · {statusLabel(shipment.returnShipment.status, t)}</p><p>{shipment.returnShipment.provider}{shipment.returnShipment.trackingNumber ? ` · ${shipment.returnShipment.trackingNumber}` : ''}</p>{shipment.returnShipment.trackingUrl && safeUrl(shipment.returnShipment.trackingUrl) && <a className="link-arrow" href={shipment.returnShipment.trackingUrl} target="_blank" rel="noreferrer">{t('orderUI.openReturn')} <span aria-hidden="true">↗</span></a>}{shipment.returnShipment.limitation && <small>{shipment.returnShipment.limitation}</small>}{shipment.returnShipment.events?.map((event, index) => <p key={`${event.code}-${index}`}>{event.description || pretty(event.code)} · {new Date(event.occurredAt).toLocaleString()}</p>)}</section>}
          </> : <p>{t('delight.noShipment')}</p>}
        </section><Timeline order={order} locale={locale} t={t} />
      </div> : <div className="order-layout">
        <section className="order-panel"><p className="account-kicker">{t('orderUI.items')}</p>
          {items.map((item) => <article className="order-line" key={item._id}><div><strong>{(locale === 'bn' ? item.productNameTranslations?.bn : item.productNameTranslations?.en) || item.productNameSnapshot}</strong><span>{item.skuSnapshot} · {Object.values(item.attributesSnapshot || {}).join(' · ')} · {locale === 'bn' ? `পরিমাণ ${item.quantity}` : `Qty ${item.quantity}`}</span></div><strong>{money(item.lineTotal, order.currency, locale)}</strong></article>)}
          <div className="order-costs"><div><span>{t('orderUI.subtotal')}</span><strong>{money(order.subtotal, order.currency, locale)}</strong></div>{order.discountTotal > 0 && <div><span>{t('orderUI.discount')}</span><strong>−{money(order.discountTotal, order.currency, locale)}</strong></div>}<div><span>{(locale === 'bn' ? order.deliverySnapshot?.nameTranslations?.bn : order.deliverySnapshot?.nameTranslations?.en) || order.deliverySnapshot?.name || t('checkout.delivery')}{order.deliverySnapshot?.estimatedDelivery ? ` · ${localizedDeliveryEta(order.deliverySnapshot.estimatedDelivery, locale === 'bn')}` : ''}</span><strong>{money(order.shippingTotal, order.currency, locale)}</strong></div>{order.taxTotal > 0 && <div><span>{t('orderUI.tax')}</span><strong>{money(order.taxTotal, order.currency, locale)}</strong></div>}<div className="order-total"><span>{t('orderUI.total')}</span><strong>{money(order.grandTotal, order.currency, locale)}</strong></div></div>
          {payment && <div className="order-payment"><p className="account-kicker">{t('orderUI.payment')} · {paymentLabel(payment.provider, t)}</p><strong>{paymentLabel(payment.status, t)}</strong><span>{payment.status === 'captured' ? `${t('orderUI.verified')} ${payment.verifiedAt ? new Date(payment.verifiedAt).toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-BD') : ''}` : payment.status === 'created' ? t('orderUI.due') : t('orderUI.verify')}</span>{['bkash','nagad'].includes(payment.provider) && payment.collectionDetails?.merchantNumber && ['requires_action','failed'].includes(payment.status) ? <WalletInstructions provider={payment.provider as 'bkash'|'nagad'} details={payment.collectionDetails} amount={money(order.grandTotal,order.currency,locale)} confirmed reference={order.orderNumber} demo={Boolean(payment.publicInstructions?.toLowerCase().includes('simulated demo'))}/> : payment.publicInstructions && <p>{payment.publicInstructions}</p>}
            {['bkash', 'nagad'].includes(payment.provider) && ['requires_action', 'failed'].includes(payment.status) && (accessToken || guestOrderToken) && <form onSubmit={(event) => { event.preventDefault(); void submit(`/users/me/orders/${order._id}/payment-reference`, { transactionId }, t('orderUI.transactionSent')) }}><label className="checkout-input"><span>{t('orderUI.transactionId')}</span><input required minLength={3} maxLength={120} value={transactionId} onChange={(event) => setTransactionId(event.target.value)} /></label><Button type="submit" disabled={busy || !transactionId.trim()}>{busy ? t('orderUI.sending') : t('orderUI.submitTransaction')}</Button></form>}
          </div>}
        </section>
        <aside className="order-panel"><p className="account-kicker">{t('orderUI.address')}</p><address>{order.shippingAddress.recipientName}<br />{formatInvoiceAddress([order.shippingAddress.line1, order.shippingAddress.line2, order.shippingAddress.area, order.shippingAddress.district, order.shippingAddress.division, order.shippingAddress.city, order.shippingAddress.division ? '' : order.shippingAddress.region, order.shippingAddress.postalCode, order.shippingAddress.countryCode])}</address>{trackingEnabled && <Button variant="secondary" onClick={() => window.location.assign(`/tracking/${order._id}`)}>{t('orderUI.track')}</Button>}
          {accessToken && order.status === 'delivered' && !order.returnRequest?.status && <form className="order-return-form" onSubmit={(event) => { event.preventDefault(); const reason = returnReason === 'other' ? `other: ${returnDetails.trim()}` : returnReason; void submit(`/users/me/orders/${order._id}/returns`, { reason }, locale === 'bn' ? 'রিটার্নের অনুরোধ পাঠানো হয়েছে।' : 'Return request sent to the store.') }}><label className="checkout-input"><span>{t('order.requestReturn')}</span><select required value={returnReason} onChange={(event) => setReturnReason(event.target.value)}><option value="">{t('order.returnReason')}</option><option value="wrong_product">{t('order.wrongProduct')}</option><option value="damaged">{t('order.damaged')}</option><option value="wrong_size">{t('order.wrongSize')}</option><option value="not_as_described">{t('order.notAsDescribed')}</option><option value="other">{t('order.other')}</option></select></label>{returnReason === 'other' && <label className="checkout-input"><span>{locale === 'bn' ? 'বিস্তারিত লিখুন' : 'Add details'}</span><textarea required minLength={5} maxLength={480} value={returnDetails} onChange={(event) => setReturnDetails(event.target.value)} /></label>}<Button type="submit" variant="secondary" disabled={busy || !returnReason || (returnReason === 'other' && returnDetails.trim().length < 5)}>{t('order.requestReturn')}</Button></form>}
          {order.returnRequest?.status && <div className="order-payment"><p className="account-kicker">{locale === 'bn' ? 'রিটার্ন অনুরোধ' : 'Return request'}</p><strong>{statusLabel(order.returnRequest.status, t)}</strong><span>{returnReasonLabel(order.returnRequest.reason || '', t)}</span>{order.returnRequest.resolutionNote && <span>{order.returnRequest.resolutionNote}</span>}</div>}
        </aside><Timeline order={order} locale={locale} t={t} />
      </div>}
    </>}
    <footer className="account-footer"><a href="/account?section=Orders">{t('orderUI.back')}</a><span>{t('orderUI.support')} · {storefront.supportEmail || t('orderUI.unavailableContact')}</span></footer>
  </section>
}

function Timeline({ order, locale, t }: { order: OrderRecord; locale: string; t: (key: string) => string }) { return <section className="order-panel order-timeline"><p className="account-kicker">{locale === 'bn' ? 'অর্ডারের ধাপ' : 'Order timeline'}</p><ol>{[...(order.timeline || [])].sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt)).map((item, index) => <li key={`${item.status}-${item.occurredAt}`} className={index === 0 ? 'is-current' : ''}><span className="tracking-events__dot" /><div><strong>{statusLabel(item.status, t)}</strong>{item.note && <span>{item.note}</span>}<time>{new Date(item.occurredAt).toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-BD')}</time></div></li>)}</ol></section> }
function money(amount: number, currency: string, locale = 'en') { return new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', { style: 'currency', currency }).format(amount / 100) }
function pretty(value: string) { if (typeof value !== 'string') return ''; return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function statusLabel(value: string, t: (key: string) => string) { const key = `order.${value}`; const known = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'in_transit', 'picked_up', 'at_hub', 'out_for_delivery', 'delivery_attempted', 'exception', 'returned_to_sender', 'delivered', 'cancelled', 'returned', 'refunded']; return known.includes(value) ? t(key) : ['requested', 'approved', 'rejected', 'received'].includes(value) ? t(`orderUI.${value}`) : pretty(value) }
function returnReasonLabel(value: string, t: (key: string) => string) { const key = ({ wrong_product: 'wrongProduct', damaged: 'damaged', wrong_size: 'wrongSize', not_as_described: 'notAsDescribed' } as Record<string, string>)[value]; if (key) return t(`order.${key}`); if (value.startsWith('other: ')) return `${t('order.other')}: ${value.slice(7)}`; return value }
function safeUrl(value: string) { try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' } catch { return false } }

function paymentLabel(value: string, t: (key: string) => string) { return ['cash_on_delivery', 'bkash', 'nagad', 'created', 'requires_action', 'authorized', 'captured', 'failed', 'refunded', 'cancelled'].includes(value) ? t(`orderUI.${value}`) : pretty(value) }
