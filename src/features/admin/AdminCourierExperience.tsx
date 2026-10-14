import { fetchWithSession } from '../../lib/session'
import { WorkspaceSkeleton } from '../../components/WorkspaceUI'
import { ResponsiveTable } from '../../components/WorkspaceUI'
import { useInterfaceText } from '../../i18n/interface-text'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { getAccessToken } from '../../lib/session'
import './admin-couriers.css'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type ProviderId = 'steadfast' | 'pathao' | 'redx'
type Provider = { provider: ProviderId; label: string; enabled: boolean; mode: 'sandbox' | 'live'; credentialsConfigured: boolean; merchant: Record<string, string>; pickup: Record<string, string>; status: string; statusMessage: string; lastTestedAt?: string | null; lastErrorCode?: string | null; capabilities: Record<string, { supported: boolean; reason?: string }> }
type ApiLog = { _id: string; provider: string; operation: string; outcome: string; errorCode?: string; message?: string; durationMs?: number; createdAt: string }
type Result<T> = { success: boolean; data?: T; error?: { message?: string } }
const ids: ProviderId[] = ['steadfast', 'pathao', 'redx']
const credentialFields: Record<ProviderId, Array<[string, string]>> = { steadfast: [['apiKey', 'API key'], ['secretKey', 'Secret key']], pathao: [['clientId', 'Client ID'], ['clientSecret', 'Client secret'], ['username', 'Merchant username'], ['password', 'Merchant password']], redx: [['accessToken', 'API access token']] }
const labels: Record<ProviderId, string> = { steadfast: 'Steadfast', pathao: 'Pathao', redx: 'RedX' }
const emptyProvider = (provider: ProviderId): Provider => ({ provider, label: labels[provider], enabled: false, mode: 'live', credentialsConfigured: false, merchant: {}, pickup: {}, status: 'configuration_required', statusMessage: 'Official API documentation must be verified.', capabilities: {} })

export default function AdminCourierExperience() {
  const text = useInterfaceText()

  const [token, setToken] = useState('')
  const [providers, setProviders] = useState<Provider[]>(ids.map(emptyProvider))
  const [selected, setSelected] = useState<ProviderId>('steadfast')
  const [defaultProvider, setDefaultProvider] = useState<ProviderId | ''>('')
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [logs, setLogs] = useState<ApiLog[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [encryptionReady, setEncryptionReady] = useState(false)
  const [customerTrackingEnabled, setCustomerTrackingEnabled] = useState(true)
  const [demoTrackingAvailable, setDemoTrackingAvailable] = useState(false)
  const active = providers.find((item) => item.provider === selected) || emptyProvider(selected)
  const call = useCallback(async <T,>(path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers); headers.set('Authorization', `Bearer ${token}`)
    if (init.body) headers.set('Content-Type', 'application/json')
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    const response = await fetchWithSession(`${apiBase}${path}`, { ...init, headers, credentials: 'include' })
    const result = await response.json() as Result<T>
    if (!response.ok || !result.success) throw new Error(result.error?.message || 'The request could not be completed.')
    return result.data as T
  }, [token])
  const load = useCallback(async () => {
    if (!token) return
    const [config, logResult] = await Promise.all([call<{ providers: Provider[]; defaultProvider: ProviderId | null; encryptionReady: boolean; customerTrackingEnabled: boolean; demoTrackingAvailable: boolean }>('/admin/couriers/providers'), call<{ logs: ApiLog[] }>('/admin/couriers/logs?page=1&limit=30')])
    setProviders(config.providers); setDefaultProvider(config.defaultProvider || ''); setEncryptionReady(config.encryptionReady); setCustomerTrackingEnabled(config.customerTrackingEnabled); setDemoTrackingAvailable(config.demoTrackingAvailable); setLogs(logResult.logs)
  }, [call, token])
  useEffect(() => { getAccessToken().then((value) => { if (value) setToken(value); else { setError('Sign in with an admin account to manage couriers.'); setLoading(false) } }).catch(() => { setError('Admin access is unavailable.'); setLoading(false) }) }, [])
  useEffect(() => { if (!token) return; load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load courier settings.')).finally(() => setLoading(false)) }, [token, load])
  const update = (patch: Partial<Provider>) => setProviders((current) => current.map((provider) => provider.provider === selected ? { ...provider, ...patch } : provider))
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const cleanCredentials = Object.fromEntries(Object.entries(credentials).filter(([, value]) => value.trim()))
      const result = await call<{ provider: Provider }>(`/admin/couriers/providers/${selected}`, { method: 'PUT', body: JSON.stringify({ enabled: active.enabled, mode: active.mode, ...(Object.keys(cleanCredentials).length ? { credentials: cleanCredentials } : {}), merchant: active.merchant, pickup: active.pickup }) })
      setProviders((current) => current.map((item) => item.provider === selected ? result.provider : item)); setCredentials({}); setNotice(`${active.label} settings saved. Connection remains Configuration Required until official API contracts are verified.`); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save courier settings.') } finally { setBusy(false) }
  }
  const saveDefault = async () => { setBusy(true); try { await call('/admin/couriers/providers/default', { method: 'PUT', body: JSON.stringify({ providerId: defaultProvider || null }) }); setNotice('Default courier updated.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the default courier.') } finally { setBusy(false) } }
  const test = async () => { setBusy(true); setError(''); setNotice(''); try { const result = await call<{ tested: boolean; message: string }>(`/admin/couriers/providers/${selected}/test`, { method: 'POST', body: '{}' }); setNotice(result.message); await load() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not check courier status.') } finally { setBusy(false) } }
  const saveTracking = async (enabled: boolean) => { setBusy(true); setError(''); setNotice(''); try { const result = await call<{ customerTrackingEnabled: boolean }>('/admin/couriers/tracking', { method: 'PUT', body: JSON.stringify({ enabled }) }); setCustomerTrackingEnabled(result.customerTrackingEnabled); setNotice(`Customer tracking is ${result.customerTrackingEnabled ? 'on' : 'off'}.`) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save tracking visibility.') } finally { setBusy(false) } }
  if (loading) return <div className="courier-admin"><WorkspaceSkeleton kind="table"/></div>
  if (!token) return <div className="courier-admin admin-console--login"><p className="account-kicker">{text("Store operations")}</p><h2>{text("Admin access")}</h2><p role="alert">{error}</p><Button onClick={() => window.location.assign('/account/sign-in')}>{text("Sign in")}</Button></div>
  return <div className="courier-admin">
    {error && <p className="catalog-feedback catalog-feedback--error" role="alert">{error}</p>}{notice && <p className="catalog-feedback" role="status">{notice}</p>}
    <div className="courier-status-note"><strong>{text("Live requests are disabled pending official API contracts.")}</strong><span>Credentials are encrypted at rest. Connection checks do not send a request while endpoint documentation is unverified.</span></div>
    <section className="courier-tracking-setting"><div><p className="account-kicker">{text("Customer visibility")}</p><h2>{text("Shipment tracking")}</h2><p>{text("When off, shipment details are hidden from customer order pages. Admin order details remain available.")}</p></div><label><input type="checkbox" checked={customerTrackingEnabled} disabled={busy} onChange={(event) => void saveTracking(event.target.checked)} /><strong>{customerTrackingEnabled ? 'ON' : 'OFF'}</strong><span>{text("Enable customer shipment tracking")}</span></label></section>
    <section className="courier-admin__overview"><div className="courier-admin__providers">{providers.map((provider) => <button type="button" className={provider.provider === selected ? 'is-selected' : ''} onClick={() => { setSelected(provider.provider); setCredentials({}); setError(''); setNotice('') }} key={provider.provider}><span>{provider.label}</span><strong>{provider.enabled ? text("Enabled") : text("Disabled")}</strong><small>{provider.status === 'configured_unverified' ? 'Configured · Unverified' : 'Configuration Required'}</small></button>)}</div><div className="courier-default"><label htmlFor="courier-default">{text("Default courier")}</label><select id="courier-default" value={defaultProvider} onChange={(event) => setDefaultProvider(event.target.value as ProviderId | '')}><option value="">{text("No default courier")}</option>{providers.filter((provider) => provider.enabled).map((provider) => <option value={provider.provider} key={provider.provider}>{provider.label}</option>)}</select><Button variant="secondary" disabled={busy} onClick={() => void saveDefault()}>{text("Save default")}</Button></div></section>
    <form className="courier-admin__form" onSubmit={(event) => void save(event)}><header><div><p className="account-kicker">{active.label} setup</p><h2>{text("Connection and pickup details")}</h2></div><span className="courier-pill">{active.status === 'configured_unverified' ? 'Configured · Unverified' : 'Configuration Required'}</span></header><div className="courier-form-grid"><label className="courier-check"><input type="checkbox" checked={active.enabled} onChange={(event) => update({ enabled: event.target.checked })} /> {text("Enable")}{active.label}</label><label>{text("Environment")}<select value={active.mode} onChange={(event) => update({ mode: event.target.value as 'sandbox' | 'live' })}><option value="sandbox">{text("Sandbox / test")}</option><option value="live">{text("Production / live")}</option></select><small>{text("Sandbox availability has not been verified for this provider.")}</small></label>
      <fieldset><legend>{text("API credentials")}</legend>{credentialFields[selected].map(([key, label]) => <label key={key}>{label}<input type="password" autoComplete="new-password" value={credentials[key] || ''} onChange={(event) => setCredentials({ ...credentials, [key]: event.target.value })} placeholder={active.credentialsConfigured ? 'Saved securely · leave blank to keep' : 'Enter credential'} /></label>)}<small>{active.credentialsConfigured ? 'Credentials stored encrypted. Enter new values to replace them.' : 'Credential values are encrypted before database storage and never returned to this screen.'}</small></fieldset>
      <fieldset><legend>{text("Merchant / store")}</legend><label>{text("Store name")}<input value={active.merchant.storeName || ''} onChange={(event) => update({ merchant: { ...active.merchant, storeName: event.target.value } })} /></label><label>{text("Contact name")}<input value={active.merchant.contactName || ''} onChange={(event) => update({ merchant: { ...active.merchant, contactName: event.target.value } })} /></label><label>{text("Phone")}<input value={active.merchant.phone || ''} onChange={(event) => update({ merchant: { ...active.merchant, phone: event.target.value } })} /></label></fieldset>
      <fieldset><legend>{text("Pickup location")}</legend><label>{text("Pickup ID")}<input value={active.pickup.locationId || ''} onChange={(event) => update({ pickup: { ...active.pickup, locationId: event.target.value } })} /></label><label>{text("Location name")}<input value={active.pickup.name || ''} onChange={(event) => update({ pickup: { ...active.pickup, name: event.target.value } })} /></label><label>{text("Address")}<input value={active.pickup.address || ''} onChange={(event) => update({ pickup: { ...active.pickup, address: event.target.value } })} /></label><label>{text("City")}<input value={active.pickup.city || ''} onChange={(event) => update({ pickup: { ...active.pickup, city: event.target.value } })} /></label><label>{text("Phone")}<input value={active.pickup.phone || ''} onChange={(event) => update({ pickup: { ...active.pickup, phone: event.target.value } })} /></label></fieldset></div><footer><Button disabled={busy}>{text("Save courier settings")}</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => void test()}>{text("Test API connection")}</Button><span>{encryptionReady ? 'Credential encryption is ready.' : 'Set the backend encryption key before saving credentials.'}</span></footer></form>
    <section className="courier-capabilities"><h2>{text("Verified provider operations")}</h2><p>Unverified operations remain disabled. This avoids sending orders through an endpoint or payload that has not been checked against official documentation.</p><div>{Object.entries(active.capabilities).map(([operation, capability]) => <article key={operation}><strong>{operation.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</strong><span>{capability.supported ? text("Available") : 'Documentation required'}</span></article>)}</div></section>
    {demoTrackingAvailable && <p className="courier-demo-note"><strong>DEMO / SIMULATED tracking is available in this non-production environment.</strong> {text("It never contacts a courier and is labeled to admins and customers.")}</p>}
    <section className="courier-logs"><h2>{text("Recent connection and API log")}</h2>{logs.length ? <div className="courier-logs__table"><ResponsiveTable><thead><tr><th>{text("Time")}</th><th>{text("Courier")}</th><th>{text("Operation")}</th><th>{text("Result")}</th><th>{text("Details")}</th></tr></thead><tbody>{logs.map((log) => <tr key={log._id}><td>{new Date(log.createdAt).toLocaleString()}</td><td>{labels[log.provider as ProviderId] || log.provider}</td><td>{log.operation.replaceAll('_', ' ')}</td><td>{log.outcome}</td><td>{log.message || log.errorCode || '—'}</td></tr>)}</tbody></ResponsiveTable></div> : <p>{text("No courier requests have been sent.")}</p>}</section>
  </div>
}
