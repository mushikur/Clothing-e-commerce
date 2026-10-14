import { DeleteRecordButton } from './AdminManagement'
import { fetchWithSession } from '../../lib/session'
import { WorkspaceSkeleton } from '../../components/WorkspaceUI'
import { useInterfaceText } from '../../i18n/interface-text'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { getAccessToken } from '../../lib/session'
import { useI18n } from '../../i18n/I18nProvider'
import { StatusBadge, WorkspaceEmpty } from '../../components/WorkspaceUI'
import { formatInvoiceAddress, InvoicePrintButton, type InvoiceBrand } from '../../components/InvoicePrintButton'
import './admin-orders.css'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type Result<T> = { success: boolean; data?: T; error?: { message?: string }; meta?: { total?: number } }
type Order = { _id: string; orderNumber: string; status: string; customer: { name: string; email: string; phone: string }; grandTotal: number; currency: string; placedAt?: string; paymentId?: { provider: string; status: string } | string; shipmentId?: { provider: string; status: string; trackingNumber?: string } | string; returnRequest?: { status?: string; reason?: string } }
type ReturnShipment = { provider: string; status: string; trackingNumber?: string; trackingUrl?: string }
type Detail = { order: Order & { subtotal: number; discountTotal: number; shippingTotal: number; taxTotal?: number; notes?:string; billingAddress?:{line1?:string;line2?:string;area?:string;district?:string;division?:string;postalCode?:string;countryCode?:string}; deliverySnapshot?: { name?: string; zone?: string; courierCode?: string; customerCharge?: number; courierCost?: number; estimatedDelivery?: string; method?: string; paymentMethod?: string }; shippingAddress?: { recipientName?: string; phone?: string; line1?: string; line2?: string; division?: string; district?: string; area?: string; postalCode?: string; countryCode?: string }; timeline: Array<{ status: string; note?: string; occurredAt: string }> }; items: Array<{ _id: string; productNameSnapshot: string; productNameTranslations?:{bn?:string}; attributesSnapshot?: Record<string, string>; skuSnapshot: string; unitPrice?: number; quantity: number; discountAmount?:number; lineTotal: number }>; payment: { provider: string; status: string; customerReference?: string; amount: number; currency: string; publicInstructions?: string } | null; shipment: { provider: string; trackingMode?: 'real' | 'manual' | 'simulated'; status: string; trackingNumber?: string; trackingUrl?: string; shippingCost?: number; currency?: string; updatedAt?: string; events?: Array<{ code: string; description?: string; occurredAt: string; location?: string }>; returnShipment?: ReturnShipment } | null }
type Wallet = { code: 'bkash' | 'nagad'; enabled: boolean; merchantNumber: string; accountType: string; instructions: string }
type CourierOption = { provider: 'steadfast' | 'pathao' | 'redx'; label: string; enabled: boolean; status: string }
const statuses = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded']
const blankWallets: Wallet[] = [{ code: 'bkash', enabled: false, merchantNumber: '', accountType: 'merchant', instructions: '' }, { code: 'nagad', enabled: false, merchantNumber: '', accountType: 'merchant', instructions: '' }]
function headers(token: string, json = false) { const value = new Headers({ Authorization: `Bearer ${token}` }); if (json) value.set('Content-Type', 'application/json'); if (import.meta.env.VITE_BUSINESS_SLUG) value.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG); return value }

export default function AdminOrdersExperience({paymentSettingsOnly=false}:{paymentSettingsOnly?:boolean}={}) {
  const text = useInterfaceText()
  const {locale,t}=useI18n()
  const [search,setSearch]=useState(''),[queryText,setQueryText]=useState(''),[paymentFilter,setPaymentFilter]=useState(''),[courierFilter,setCourierFilter]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState('')
  const [page,setPage]=useState(1),[pages,setPages]=useState(1),[total,setTotal]=useState(0),[listLoading,setListLoading]=useState(false)
  const listAbort=useRef<AbortController|null>(null)

  const [token, setToken] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedId, setSelectedId] = useState(()=>new URLSearchParams(window.location.search).get('order')||(window.location.pathname.split('/')[3]||''))
  const [detail, setDetail] = useState<Detail | null>(null)
  const [wallets, setWallets] = useState<Wallet[]>(blankWallets)
  const [filter, setFilter] = useState('')
  const [nextStatus, setNextStatus] = useState('')
  const [note, setNote] = useState('')
  const [reference, setReference] = useState('')
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [returnProvider, setReturnProvider] = useState('')
  const [returnStatus, setReturnStatus] = useState('booked')
  const [returnTrackingNumber, setReturnTrackingNumber] = useState('')
  const [returnTrackingUrl, setReturnTrackingUrl] = useState('')
  const [courierOptions, setCourierOptions] = useState<CourierOption[]>([])
  const [demoTrackingAvailable, setDemoTrackingAvailable] = useState(false)
  const [selectedCourier, setSelectedCourier] = useState<'steadfast' | 'pathao' | 'redx' | ''>('')
  const [autoCreateShipment, setAutoCreateShipment] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [invoiceBrand, setInvoiceBrand] = useState<InvoiceBrand>({ name: 'Store' })

  const call = useCallback(async <T,>(url: string, init: RequestInit = {}) => {
    const response = await fetchWithSession(`${apiBase}${url}`, { ...init, headers: new Headers([...headers(token, Boolean(init.body)), ...new Headers(init.headers)]) , credentials: 'include' })
    const result = await response.json() as Result<T>
    if (!response.ok || !result.success) throw new Error(result.error?.message || 'The update could not be completed.')
    if(url.startsWith('/admin/orders?')) { setTotal(result.meta?.total??0);setPages(Math.max(1,(result.meta as {pages?:number})?.pages??1)) }
    return result.data as T
  }, [token])
  const loadList = useCallback(async () => {
    if (!token||paymentSettingsOnly) return
    if(from&&to&&from>to){setError(text('Start date must precede end date'));return}
    listAbort.current?.abort();const controller=new AbortController();listAbort.current=controller;setListLoading(true)
    const query = new URLSearchParams({page:String(page),limit:'12',...(filter?{status:filter}:{}),...(queryText?{q:queryText}:{}),...(paymentFilter?{payment:paymentFilter}:{}),...(courierFilter?{courier:courierFilter}:{}),...(from?{from:new Date(`${from}T00:00:00`).toISOString()}:{}),...(to?{to:new Date(`${to}T23:59:59.999`).toISOString()}:{})})
    try{const result=await call<{orders:Order[]}>(`/admin/orders?${query}`,{signal:controller.signal});if(!controller.signal.aborted){setOrders(result.orders);setError('')}}
    catch(cause){if(!controller.signal.aborted)throw cause}finally{if(!controller.signal.aborted)setListLoading(false)}
  }, [call,filter,token,page,queryText,paymentFilter,courierFilter,from,to,paymentSettingsOnly,text])
  useEffect(()=>{const timer=window.setTimeout(()=>setQueryText(search.trim()),250);return()=>window.clearTimeout(timer)},[search])
  useEffect(()=>{setPage(1)},[queryText,filter,paymentFilter,courierFilter,from,to])
  useEffect(()=>()=>listAbort.current?.abort(),[])
  useEffect(()=>{const pop=()=>{setSelectedId(new URLSearchParams(window.location.search).get('order')||window.location.pathname.split('/')[3]||'')};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[])
  const loadDetail = useCallback(async (id: string) => {
    if (!id) {setDetail(null);return}
    const result = await call<Detail>(`/admin/orders/${id}`)
    setDetail(result); setNextStatus(result.order.status); setReference('')
    if (result.shipment) { setCarrier(result.shipment.provider); setTrackingNumber(result.shipment.trackingNumber || ''); setTrackingUrl(result.shipment.trackingUrl || ''); setSelectedCourier(result.shipment.provider as 'steadfast' | 'pathao' | 'redx'); setReturnProvider(result.shipment.returnShipment?.provider || ''); setReturnStatus(result.shipment.returnShipment?.status || 'booked'); setReturnTrackingNumber(result.shipment.returnShipment?.trackingNumber || ''); setReturnTrackingUrl(result.shipment.returnShipment?.trackingUrl || '') }
  }, [call])
  const refresh = useCallback(async () => { await loadList(); if (selectedId) await loadDetail(selectedId) }, [loadDetail, loadList, selectedId])

  useEffect(() => {
    let alive = true
    getAccessToken().then((accessToken) => {
      if (!accessToken) throw new Error('Sign in with an admin account to manage orders.')
      if (alive) setToken(accessToken)
    }).catch((cause: unknown) => { if (alive) setError(cause instanceof Error ? cause.message : 'Admin session is unavailable.') }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])
  useEffect(() => { void loadList().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load orders.')) }, [loadList])
  useEffect(() => { void loadDetail(selectedId).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load this order.')) }, [loadDetail, selectedId])
  useEffect(() => { if (token) void call<{ paymentMethods: Wallet[] }>('/admin/settings/payments').then((result) => { if (result.paymentMethods.length) setWallets(blankWallets.map((wallet) => ({ ...wallet, ...result.paymentMethods.find((item) => item.code === wallet.code) }))) }).catch(() => undefined) }, [call, token])
  useEffect(() => { if (token) void call<{ providers: CourierOption[]; defaultProvider: 'steadfast' | 'pathao' | 'redx' | null; demoTrackingAvailable: boolean }>('/admin/couriers/providers').then((result) => { setCourierOptions(result.providers); setDemoTrackingAvailable(result.demoTrackingAvailable); setSelectedCourier((current) => current || result.defaultProvider || result.providers.find((provider) => provider.enabled)?.provider || '') }).catch(() => undefined) }, [call, token])
  useEffect(() => {
    if (!token) return
    const requestHeaders = headers(token)
    fetchWithSession(`${apiBase}/storefront/config`, { headers: requestHeaders, credentials: 'include' }).then(async (response) => {
      const result = await response.json() as Result<{ settings?: { displayName?: string; logoUrl?: string; contact?: { email?: string; phone?: string; address?: string } }; theme?: { colors?: { primary?: string; accent?: string } } | null }>
      if (!response.ok || !result.success) return
      setInvoiceBrand({ name: result.data?.settings?.displayName || 'Store', logoUrl: result.data?.settings?.logoUrl, email: result.data?.settings?.contact?.email, phone: result.data?.settings?.contact?.phone, address: result.data?.settings?.contact?.address, primary: result.data?.theme?.colors?.primary, accent: result.data?.theme?.colors?.accent })
    }).catch(() => undefined)
  }, [token])

  const action = async (endpoint: string, method: string, body: object, success: string) => {
    setBusy(true); setError(''); setMessage('')
    try { await call(endpoint, { method, body: JSON.stringify(body) }); setMessage(success); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The update could not be completed.') }
    finally { setBusy(false) }
  }
  const saveWallets = async () => {
    setBusy(true); setError(''); setMessage('')
    try { await call('/admin/settings/payments', { method: 'PUT', body: JSON.stringify({ paymentMethods: wallets }) }); setMessage('Mobile wallet settings saved.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save payment settings.') }
    finally { setBusy(false) }
  }
  const saveOrderStatus = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      await call(`/admin/orders/${detail!.order._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus, note, ...(nextStatus === 'cancelled' ? { reason: note } : {}) }) })
      setMessage('Order status updated.')
      if (nextStatus === 'confirmed' && autoCreateShipment && selectedCourier) {
        try {
          await call(`/admin/orders/${detail!.order._id}/shipment/create`, { method: 'POST', body: JSON.stringify({ providerId: selectedCourier }) })
          setMessage('Order confirmed and courier shipment created.')
        } catch (cause) { setMessage(`Order confirmed. Shipment was not created: ${cause instanceof Error ? cause.message : 'courier integration is unavailable'}`) }
      }
      await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The order update could not be completed.') }
    finally { setBusy(false) }
  }

  const invoiceDetails = detail ? {
    number: detail.order.orderNumber, title: 'Sales invoice', status: detail.order.status.replaceAll('_', ' '), date: detail.order.placedAt ? new Date(detail.order.placedAt).toLocaleDateString(locale==='bn'?'bn-BD':'en-BD') : undefined,
    currency: detail.order.currency, customer: { name: detail.order.customer.name, email: detail.order.customer.email, phone: detail.order.customer.phone },
    address: formatInvoiceAddress([detail.order.shippingAddress?.line1, detail.order.shippingAddress?.line2, detail.order.shippingAddress?.area, detail.order.shippingAddress?.district, detail.order.shippingAddress?.division, detail.order.shippingAddress?.postalCode, detail.order.shippingAddress?.countryCode]),
    billingAddress:formatInvoiceAddress([detail.order.billingAddress?.line1,detail.order.billingAddress?.line2,detail.order.billingAddress?.area,detail.order.billingAddress?.district,detail.order.billingAddress?.division,detail.order.billingAddress?.postalCode,detail.order.billingAddress?.countryCode]),notes:detail.order.notes,payment:detail.payment?.provider,paymentStatus:detail.payment?.status,delivery:detail.order.deliverySnapshot?.name,courier:detail.shipment?.provider,trackingNumber:detail.shipment?.trackingNumber,
    lines: detail.items.map((item) => ({ name: locale === 'bn' ? item.productNameTranslations?.bn || item.productNameSnapshot : item.productNameSnapshot, sku: item.skuSnapshot, variant: Object.values(item.attributesSnapshot || {}).join(' · '), quantity: item.quantity, unitPrice: item.unitPrice ?? (item.quantity ? Math.round(item.lineTotal / item.quantity) : 0), total:item.lineTotal,discount:item.discountAmount })),
    subtotal: detail.order.subtotal, discount: detail.order.discountTotal, shipping: detail.order.shippingTotal, tax: detail.order.taxTotal || 0, total: detail.order.grandTotal,
  } : null

  if (loading) return <div className="admin-orders"><WorkspaceSkeleton kind="table"/></div>
  return <div className="admin-orders">
    {error && <p className="catalog-feedback catalog-feedback--error" role="alert">{error}</p>}{message && <p className="catalog-feedback" role="status">{message}</p>}
    {paymentSettingsOnly&&<section className="admin-orders__settings"><div><p className="account-kicker">{text("Payment setup")}</p><h2>{text("Mobile wallet collection")}</h2><p>{t('guides.setupHelp')}</p></div>{wallets.map((wallet, index) => <fieldset key={wallet.code}><legend>{wallet.code === 'bkash' ? 'bKash' : 'Nagad'}</legend><label><input type="checkbox" checked={wallet.enabled} onChange={(event) => setWallets((current) => current.map((item, i) => i === index ? { ...item, enabled: event.target.checked } : item))} /> {text("Enabled")}</label><label>{t('guides.collectionNumber')}<input type="tel" inputMode="tel" maxLength={40} value={wallet.merchantNumber} onChange={(event) => setWallets((current) => current.map((item, i) => i === index ? { ...item, merchantNumber: event.target.value } : item))} /></label><label>{text("Account type")}<select value={wallet.accountType || 'personal'} onChange={(event) => setWallets((current) => current.map((item, i) => i === index ? { ...item, accountType: event.target.value } : item))}><option value="personal">{t('guides.personal')} · {t('guides.sendMoney')}</option><option value="merchant">{t('guides.merchant')} · {t('guides.payment')}</option>{wallet.accountType && !['personal','merchant'].includes(wallet.accountType) && <option value={wallet.accountType}>{wallet.accountType}</option>}</select></label><label>{text("Customer instructions")}<textarea rows={2} maxLength={500} value={wallet.instructions} onChange={(event) => setWallets((current) => current.map((item, i) => i === index ? { ...item, instructions: event.target.value } : item))} /></label></fieldset>)}<Button disabled={busy} onClick={() => void saveWallets()}>{text("Save payment settings")}</Button></section>}
    {!paymentSettingsOnly&&<><div className="admin-order-filters"><label>{text('Search orders')}<input value={search} placeholder={text('Order number, customer or phone')} onChange={event=>setSearch(event.target.value)}/></label><label>{text('Payment method')}<select value={paymentFilter} onChange={event=>setPaymentFilter(event.target.value)}><option value="">{text('All payment methods')}</option><option value="cash_on_delivery">{text('Cash on delivery')}</option><option value="bkash">bKash</option><option value="nagad">Nagad</option></select></label><label>{text('Courier provider')}<select value={courierFilter} onChange={event=>setCourierFilter(event.target.value)}><option value="">{text('All couriers')}</option>{courierOptions.map(provider=><option key={provider.provider} value={provider.provider}>{provider.label}</option>)}</select></label><label>{text('Start date')}<input type="date" value={from} max={to||undefined} onChange={event=>setFrom(event.target.value)}/></label><label>{text('End date')}<input type="date" value={to} min={from||undefined} onChange={event=>setTo(event.target.value)}/></label><Button variant="secondary" onClick={()=>{setSearch('');setPaymentFilter('');setCourierFilter('');setFrom('');setTo('');setFilter('')}}>{text('Reset filters')}</Button></div><div className="admin-orders__layout"><section className="admin-orders__list"><div className="admin-orders__toolbar"><h2>{text("Recent orders")}</h2><select aria-label={text("Filter orders by status")} value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">{text("All statuses")}</option>{statuses.map((status) => <option key={status} value={status}>{text(pretty(status))}</option>)}</select></div>{listLoading?<WorkspaceSkeleton/>:orders.map((order) => { const payment = typeof order.paymentId === 'object' ? order.paymentId : undefined; const shipment = typeof order.shipmentId === 'object' ? order.shipmentId : undefined; return <button className={`admin-orders__row ${selectedId === order._id ? 'is-selected' : ''}`} key={order._id} onClick={()=>{setSelectedId(order._id);window.history.pushState({},'',`/admin/orders?order=${order._id}`)}}><span><strong>{order.orderNumber}</strong><small>{order.customer.name} · {order.customer.email}</small><small>{payment ? `${pretty(payment.provider)} · ${pretty(payment.status)}` : 'Payment pending'} · {shipment?.provider || 'Courier pending'} · {order.placedAt ? new Date(order.placedAt).toLocaleDateString() : 'Date unavailable'}</small></span><span><strong>{money(order.grandTotal, order.currency)}</strong><StatusBadge status={order.status}/></span></button> })}{!listLoading&&!orders.length&&<WorkspaceEmpty title={text('No orders match this view.')}/>}<div className="admin-order-pagination"><span>{total} {text('Orders')} · {page} / {pages}</span><div><Button variant="secondary" size="sm" disabled={page<=1||listLoading} onClick={()=>setPage(value=>value-1)}>{text('Previous')}</Button><Button variant="secondary" size="sm" disabled={page>=pages||listLoading} onClick={()=>setPage(value=>value+1)}>{text('Next')}</Button></div></div></section>{!detail&&<WorkspaceEmpty title={text('Choose an order')} detail={text('Select an order to review its customer, payment and delivery details.')}/>} 
      {detail && <section className="admin-orders__detail"><header><div><p className="account-kicker">{text("Order detail")}</p><h2>{detail.order.orderNumber}</h2><p>{detail.order.customer.name} · {detail.order.customer.email} · {detail.order.customer.phone}</p></div><div className="admin-order-detail__invoice"><strong>{money(detail.order.grandTotal, detail.order.currency)}</strong>{invoiceDetails && <InvoicePrintButton invoice={invoiceDetails} brand={invoiceBrand} locale={locale} />}<DeleteRecordButton kind="order" recordKey={detail.order._id} name={detail.order.orderNumber} onDeleted={()=>{setSelectedId('');setDetail(null);window.history.replaceState({},'','/admin/orders');void loadList().catch(cause=>setError(cause.message))}}/></div></header><section className="admin-order-payment"><h3>{text("Delivery charge snapshot")}</h3><p>{text("Area:")}<strong>{[detail.order.deliverySnapshot?.name, detail.order.shippingAddress?.area, detail.order.shippingAddress?.district, detail.order.shippingAddress?.division].filter(Boolean).join(' · ') || 'Legacy delivery record'}</strong></p><p>{text("Delivery method:")}{detail.order.deliverySnapshot?.method || 'Standard'} {text("· ETA:")}{detail.order.deliverySnapshot?.estimatedDelivery || 'Not recorded'}</p><p>{text("Customer delivery charge:")}<strong>{money(detail.order.deliverySnapshot?.customerCharge ?? detail.order.shippingTotal, detail.order.currency)}</strong></p><p>{text("Courier:")}{detail.order.deliverySnapshot?.courierCode || 'Not assigned'} {text("· Internal courier cost:")}{detail.order.deliverySnapshot?.courierCost == null ? 'Not recorded' : money(detail.order.deliverySnapshot.courierCost, detail.order.currency)}</p></section><div className="admin-order-items">{detail.items.map((item) => <article key={item._id}><span>{locale === 'bn' ? item.productNameTranslations?.bn || item.productNameSnapshot : item.productNameSnapshot} · {item.skuSnapshot} {text("· Qty")}{item.quantity}</span><strong>{money(item.lineTotal, detail.order.currency)}</strong></article>)}</div>
        <div className="admin-order-actions"><label>{text("Update order status")}<select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>{statuses.map((status) => <option value={status} key={status}>{text(pretty(status))}</option>)}</select></label><label>{text("Reason / update note")}<input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder={text("Optional note")} /></label>{nextStatus === 'confirmed' && detail.order.status !== 'confirmed' && <label className="admin-auto-ship"><span>{text("Courier")}</span><select aria-label={text("Courier for new shipment")} value={selectedCourier} onChange={(event) => setSelectedCourier(event.target.value as typeof selectedCourier)}><option value="">{text("Select courier")}</option>{courierOptions.filter((provider) => provider.enabled).map((provider) => <option key={provider.provider} value={provider.provider}>{provider.label}</option>)}</select><span><input type="checkbox" checked={autoCreateShipment} onChange={(event) => setAutoCreateShipment(event.target.checked)} /> {text("Create courier shipment automatically")}</span></label>}<Button disabled={busy || nextStatus === detail.order.status} onClick={() => void saveOrderStatus()}>{text("Save status")}</Button></div>
        {detail.payment && <section className="admin-order-payment"><h3>{text("Payment ·")}{pretty(detail.payment.provider)}</h3><p>{pretty(detail.payment.status)} · {money(detail.payment.amount, detail.payment.currency)}</p>{detail.payment.customerReference && <p>{text("Customer transaction ID:")}<strong>{detail.payment.customerReference}</strong></p>}{detail.payment.provider !== 'cash_on_delivery' && ['requires_action', 'authorized', 'created'].includes(detail.payment.status) && <Button disabled={busy} onClick={() => void action(`/admin/orders/${detail.order._id}/payment`, 'PATCH', { action: 'verify', reference }, 'Payment marked verified.')}>{text("Mark payment verified")}</Button>}{detail.payment.provider !== 'cash_on_delivery' && !['captured', 'refunded'].includes(detail.payment.status) && <Button variant="secondary" disabled={busy} onClick={() => void action(`/admin/orders/${detail.order._id}/payment`, 'PATCH', { action: 'fail', note }, 'Payment marked failed.')}>{text("Mark failed")}</Button>}{detail.payment.status === 'captured' && <div className="admin-refund"><label>{text("Refund transaction reference")}<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={text("Reference from provider")} /></label><Button variant="secondary" disabled={busy || !reference.trim()} onClick={() => void action(`/admin/orders/${detail.order._id}/payment`, 'PATCH', { action: 'refund', reference, note }, 'Refund recorded.')}>{text("Record refund")}</Button><small>{text("Process the refund with the provider first, then record its reference here.")}</small></div>}</section>}
        {detail.order.returnRequest?.status && <section className="admin-order-payment"><h3>{text("Return ·")}{pretty(detail.order.returnRequest.status)}</h3><p>{detail.order.returnRequest.reason}</p>{detail.order.returnRequest.status === 'requested' && <><Button disabled={busy} onClick={() => void action(`/admin/orders/${detail.order._id}/returns`, 'PATCH', { action: 'approve', note }, 'Return approved.')}>{text("Approve return")}</Button><Button variant="secondary" disabled={busy} onClick={() => void action(`/admin/orders/${detail.order._id}/returns`, 'PATCH', { action: 'reject', note }, 'Return declined.')}>{text("Decline")}</Button></>}{['approved', 'received'].includes(detail.order.returnRequest.status) && <div className="admin-return-manual"><h4>{text("Return shipment · Manual fallback")}</h4><p>Official return-booking APIs are not verified for these couriers. Record a manually arranged return shipment; this does not send a courier API request.</p><label>{text("Courier / provider")}<input value={returnProvider} onChange={(event) => setReturnProvider(event.target.value)} placeholder={text("Courier arranged outside this store")} /></label><label>{text("Return status")}<select value={returnStatus} onChange={(event) => setReturnStatus(event.target.value)}>{['booked', 'picked_up', 'in_transit', 'returned', 'inspection', 'complete'].map((status) => <option value={status} key={status}>{text(pretty(status))}</option>)}</select></label><label>{text("Tracking / consignment ID")}<input value={returnTrackingNumber} onChange={(event) => setReturnTrackingNumber(event.target.value)} /></label><label>{text("Tracking URL")}<input type="url" value={returnTrackingUrl} onChange={(event) => setReturnTrackingUrl(event.target.value)} /></label><Button variant="secondary" disabled={busy || returnProvider.trim().length < 2} onClick={() => void action(`/admin/orders/${detail.order._id}/returns/shipment`, 'PUT', { provider: returnProvider, status: returnStatus, trackingNumber: returnTrackingNumber || undefined, trackingUrl: returnTrackingUrl || undefined, note }, 'Manual return shipment recorded.')}>{text("Record manual return shipment")}</Button></div>}</section>}
        <section className="admin-order-payment"><h3>{text("Shipment and tracking")}</h3><label>{text("Courier")}<select value={selectedCourier} onChange={(event) => setSelectedCourier(event.target.value as typeof selectedCourier)}><option value="">{text("Select courier")}</option>{courierOptions.filter((provider) => provider.enabled).map((provider) => <option key={provider.provider} value={provider.provider}>{provider.label}</option>)}</select></label>{detail.shipment && <><p>{text("Shipment status:")}{pretty(detail.shipment.status)}{detail.shipment.trackingMode === 'simulated' ? ' · DEMO / SIMULATED' : detail.shipment.trackingMode === 'manual' ? ' · Manually recorded' : ''}</p>{detail.shipment.trackingNumber && <p>{text("Tracking ID:")}<strong>{detail.shipment.trackingNumber}</strong></p>}{detail.shipment.shippingCost !== undefined && <p>{text("Delivery fee:")}{money(detail.shipment.shippingCost, detail.shipment.currency || detail.order.currency)}</p>}{detail.shipment.updatedAt && <p>{text("Last updated:")}{new Date(detail.shipment.updatedAt).toLocaleString()}</p>}{detail.shipment.events?.length ? <ol>{detail.shipment.events.map((event, index) => <li key={`${event.code}-${index}`}>{event.description || pretty(event.code)} · {new Date(event.occurredAt).toLocaleString()}</li>)}</ol> : null}{detail.shipment.trackingUrl && <a href={detail.shipment.trackingUrl} target="_blank" rel="noreferrer">Open tracking page ↗</a>}</>}{!detail.shipment && <Button disabled={busy || !selectedCourier || !['confirmed', 'processing', 'packed'].includes(detail.order.status)} onClick={() => void action(`/admin/orders/${detail.order._id}/shipment/create`, 'POST', { providerId: selectedCourier }, 'Courier shipment created.')}>{text("Create shipment")}</Button>}<p>Automatic booking remains unavailable until this courier’s official API contract is verified. Manual entries do not contact the provider.</p>{demoTrackingAvailable && <div className="admin-demo-shipment"><strong>DEMO / SIMULATED tracking</strong><p>Creates visibly simulated events without contacting a courier. Click again to advance the shipment status.</p><Button variant="secondary" disabled={busy || ['cancelled', 'returned', 'refunded'].includes(detail.order.status) || detail.shipment?.trackingMode === 'manual' || detail.shipment?.trackingMode === 'real' || detail.shipment?.status === 'delivered'} onClick={() => void action(`/admin/orders/${detail.order._id}/shipment/demo`, 'POST', {}, detail.shipment ? 'Demo tracking status advanced.' : 'Simulated demo shipment created.')}>{detail.shipment?.trackingMode === 'simulated' ? 'Advance demo tracking' : 'Create demo shipment'}</Button></div>}<label>{text("Manual courier/provider")}<input value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder={text("Courier arranged outside this store")} /></label><label>{text("Manual tracking number")}<input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} /></label><label>{text("Manual tracking URL")}<input type="url" value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} /></label><Button variant="secondary" disabled={busy || carrier.trim().length < 2 || detail.shipment?.trackingMode === 'simulated'} onClick={() => void action(`/admin/orders/${detail.order._id}/shipment`, 'PUT', { provider: carrier, trackingNumber: trackingNumber || undefined, trackingUrl: trackingUrl || undefined, status: 'booked' }, 'Manual shipment tracking saved.')}>{text("Save manual tracking")}</Button></section>
        <section className="admin-order-payment"><h3>{text("Order timeline")}</h3><ol>{[...detail.order.timeline].reverse().map((entry, index) => <li key={`${entry.status}-${entry.occurredAt}-${index}`}><strong>{pretty(entry.status)}</strong><span>{entry.note} · {new Date(entry.occurredAt).toLocaleString()}</span></li>)}</ol></section>
      </section>}
    </div></>}
  </div>
}
function money(amount: number, currency: string) { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100) }
function pretty(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
