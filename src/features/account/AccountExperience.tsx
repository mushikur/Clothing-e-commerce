import { fetchWithSession } from '../../lib/session'
import { useInterfaceText } from '../../i18n/interface-text'
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import './account.css'
import { clearAccessToken, getAccessToken,installAccessToken } from '../../lib/session'
import { useI18n } from '../../i18n/I18nProvider'
import { useBusinessConfig } from '../storefront/StorefrontConfig'
import { Button as DesignButton } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { StatusBadge, WorkspaceSkeleton, WorkspaceEmpty } from '../../components/WorkspaceUI'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
const businessSlug = import.meta.env.VITE_BUSINESS_SLUG
type User = { id: string; name: string; email: string; phone?: string; role: string; emailVerifiedAt?: string; createdAt?: string }
type Address = { _id: string; label?: string; recipientName: string; phone: string; line1: string; line2?: string; city: string; region?: string; division?: string; district?: string; area?: string; postalCode?: string; countryCode: string; isDefaultShipping: boolean; isDefaultBilling: boolean }
type ApiResult<T> = { success: boolean; data?: T; error?: { message?: string; code?:string } }
const blankAddress = { label: '', recipientName: '', phone: '', line1: '', line2: '', city: '', region: '', division: '', district: '', area: '', postalCode: '', countryCode: 'BD', isDefaultShipping: true, isDefaultBilling: false }

export default function AccountExperience() {
  const text = useInterfaceText()
  const {config,settings}=useBusinessConfig()
  const storeName=settings.displayName||config.name
  const [sessionLoading,setSessionLoading]=useState(window.location.pathname==='/account')
  const [recordsLoading,setRecordsLoading]=useState(false)

  const [path, setPath] = useState(window.location.pathname)
  const [token, setToken] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [section, setSection] = useState(() => ['Profile', 'Orders', 'Wishlist', 'Addresses', 'Notifications', 'Password settings'].includes(new URLSearchParams(window.location.search).get('section') || '') ? new URLSearchParams(window.location.search).get('section')! : 'Profile')
  const [records, setRecords] = useState<Record<string, unknown>[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressFormOpen, setAddressFormOpen] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState('')
  const [profile, setProfile] = useState({ name: '', phone: '' })
  const [address, setAddress] = useState(blankAddress)

  const request = useCallback(async <T,>(pathName: string, options: RequestInit = {}, access = token): Promise<T> => {
    const headers = new Headers(options.headers)
    headers.set('Content-Type', 'application/json')
    if (businessSlug) headers.set('X-Business-Slug', businessSlug)
    if (access) headers.set('Authorization', `Bearer ${access}`)
    const response = await fetchWithSession(`${apiBase}${pathName}`, { ...options, headers, credentials: 'include' })
    const result = await response.json() as ApiResult<T>
    if (!response.ok || !result.success) throw new Error(text(response.status===429?'Too many attempts. Please wait before trying again.':({invalid_credentials:'Email or password is incorrect.',email_verification_required:'Verify your email before signing in.',account_exists:'An account with this email already exists.',invalid_reset_token:'This reset link has expired. Request a new link.',invalid_verification_token:'This verification link has expired.',current_password_incorrect:'Current password is incorrect.'} as Record<string,string>)[result.error?.code||'']||'We could not complete your request. Please check your details and try again.'))
    return result.data as T
  }, [token,text])

  const installSession = useCallback(async (nextToken: string) => {
    installAccessToken(nextToken)
    setToken(nextToken)
    const result = await request<{ user: User }>('/auth/me', {}, nextToken)
    setUser(result.user)
    setProfile({ name: result.user.name, phone: result.user.phone ?? '' })
    const returnTo=new URLSearchParams(window.location.search).get('returnTo')
    if(returnTo&&/^\/admin(?:[/?]|$)/.test(returnTo)&&['super_admin','admin','manager','staff'].includes(result.user.role)){window.location.assign(returnTo==='/admin/login'?'/admin':returnTo);return}
    window.history.pushState({}, '', '/account')
    setPath('/account')
  }, [request])

  useEffect(() => {
    const onPop = () => {setPath(window.location.pathname);setSection(new URLSearchParams(window.location.search).get('section')||'Profile')}
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (path !== '/account' || token) return
    let alive = true
    getAccessToken().then(async (accessToken) => {
      if (!accessToken) throw new Error('Sign in to view your account.')
      if (!alive) return
      const result = await request<{ user: User }>('/auth/me', {}, accessToken)
      if (alive) { setToken(accessToken); setUser(result.user); setProfile({ name: result.user.name, phone: result.user.phone ?? '' }) }
    }).catch(() => { if (alive) { window.history.replaceState({}, '', '/account/sign-in'); setPath('/account/sign-in') } }).finally(()=>{if(alive)setSessionLoading(false)})
    return () => { alive = false }
  }, [path, request, token])

  useEffect(() => {
    if (!user) return
    let active = true
    const endpoint: Record<string, string> = { Orders: '/users/me/orders', Wishlist: '/users/me/wishlist', Notifications: '/users/me/notifications', Addresses: '/users/me/addresses' }
    if (!endpoint[section]) { setRecords([]); return }
    setRecordsLoading(true)
    request<Record<string, unknown>>(endpoint[section]).then((result) => {
      if (!active) return
      if (section === 'Addresses') setAddresses((result.addresses as Address[]) ?? [])
      const key = section === 'Orders' ? 'orders' : section === 'Wishlist' ? 'products' : section === 'Notifications' ? 'notifications' : 'addresses'
      setRecords((result[key] as Record<string, unknown>[]) ?? [])
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load account details.') }).finally(()=>{if(active)setRecordsLoading(false)})
    return () => { active = false }
  }, [user, section, request])

  const submit = async (event: FormEvent<HTMLFormElement>, action: () => Promise<void>) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Something went wrong.') } finally { setBusy(false) }
  }
  const removeAddress = async (id: string) => {
    setBusy(true); setError('')
    try { await request(`/users/me/addresses/${id}`, { method: 'DELETE' }); setAddresses((items) => items.filter((item) => item._id !== id)); setNotice(text("Address removed.")) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to remove this address.') }
    finally { setBusy(false) }
  }
  const editAddress = (item: Address) => {
    setEditingAddressId(item._id)
    setAddress({ label: item.label ?? '', recipientName: item.recipientName, phone: item.phone, line1: item.line1, line2: item.line2 ?? '', city: item.city, region: item.region ?? '', division: item.division ?? '', district: item.district ?? '', area: item.area ?? '', postalCode: item.postalCode ?? '', countryCode: item.countryCode, isDefaultShipping: item.isDefaultShipping, isDefaultBilling: item.isDefaultBilling })
    setAddressFormOpen(true)
  }
  if(sessionLoading&&path==='/account')return <main className="account-page"><WorkspaceSkeleton kind="form"/></main>

  const adminEntry=new URLSearchParams(window.location.search).get('returnTo')?.startsWith('/admin')
  const pageTitle = adminEntry?'Admin access':path.includes('register') ? 'Create your account' : path.includes('forgot-password') ? 'A fresh start' : path.includes('reset-password') ? 'Choose a new password' : path.includes('verify-email') ? 'Confirm your email' : 'Welcome back'

  if (path === '/account' && user) return <main className="account-page account-dashboard">
      <header className="account-top"><a href="/" className="account-wordmark">{storeName}</a><button className="account-text-button" onClick={async () => { await request('/auth/logout', { method: 'POST' }); clearAccessToken(); setToken(''); setUser(null); window.history.pushState({}, '', '/account/sign-in'); setPath('/account/sign-in') }}>{text("Sign out")}</button></header>
    <div className="account-dashboard__intro"><p className="account-kicker">{text("Your account")}</p><h1>{text('Welcome back,')} {user.name.split(' ')[0]}.</h1><p>{text("Manage your details and keep track of the pieces you love.")}</p></div>
    <div className="account-dashboard__layout"><nav className="account-sidebar" aria-label="Account sections">{['Profile', 'Orders', 'Wishlist', 'Addresses', 'Notifications', 'Password settings'].map((item) => <button key={item} className={section === item ? 'is-active' : ''} aria-current={section===item?'page':undefined} onClick={()=>{if(item==='Wishlist'){window.location.assign('/wishlist');return}setSection(item);window.history.pushState({},'',`/account?section=${encodeURIComponent(item)}`);setError('');setNotice('')}}><Icon name={item==='Orders'?'bag':item==='Wishlist'?'heart':item==='Addresses'?'truck':item==='Profile'?'user':item==='Notifications'?'document':'settings'}/><span>{text(item)}</span></button>)}</nav>
      <section className="account-panel" aria-live="polite"><div className="account-panel__heading"><div><p className="account-kicker">{text("Account details")}</p><h2>{text(section)}</h2></div></div>
        {error && <p className="account-alert account-alert--error" role="alert">{error}</p>}{notice && <p className="account-alert" role="status">{notice}</p>}
        {section === 'Profile' && <form className="account-form account-form--wide" onSubmit={(event) => submit(event, async () => { const data = await request<{ user: User }>('/users/me', { method: 'PATCH', body: JSON.stringify(profile) }); setUser(data.user); setNotice(text("Your details have been saved.")) })}><Field label={text("Full name")}><input required maxLength={100} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field><Field label={text("Email address")}><input disabled value={user.email} /><small>{text("Email is verified and cannot be edited here.")}</small></Field><Field label={text("Phone number")}><input maxLength={32} value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field><Button disabled={busy}>{busy ? text("Saving…") : text("Save changes")}</Button></form>}
        {section === 'Password settings' && <form className="account-form account-form--wide" onSubmit={(event) => submit(event, async () => { const form = new FormData(event.currentTarget); const result = await request<{ accessToken: string; user: User }>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: form.get('currentPassword'), newPassword: form.get('newPassword') }) }); installAccessToken(result.accessToken); setToken(result.accessToken); setUser(result.user); setNotice(text("Your password has been updated.")) })}><Field label={text("Current password")}><input name="currentPassword" type="password" autoComplete="current-password" required /></Field><Field label={text("New password")}><input name="newPassword" type="password" minLength={12} maxLength={72} autoComplete="new-password" required /><small>{text("Use at least 12 characters.")}</small></Field><Button disabled={busy}>{busy ? text("Updating…") : text("Update password")}</Button></form>}
        {section === 'Addresses' && <div className="account-list"><div className="account-list__toolbar"><p className="muted">{text("Saved delivery details")}</p><Button variant="secondary" onClick={() => { if (addressFormOpen) { setAddressFormOpen(false); setEditingAddressId(''); setAddress(blankAddress) } else { setAddressFormOpen(true) } }}>{addressFormOpen ? text("Close") : text("Add address")}</Button></div>{addressFormOpen && <form className="address-form" onSubmit={(event) => submit(event, async () => { const endpoint = editingAddressId ? `/users/me/addresses/${editingAddressId}` : '/users/me/addresses'; await request(endpoint, { method: editingAddressId ? 'PATCH' : 'POST', body: JSON.stringify(address) }); const data = await request<{ addresses: Address[] }>('/users/me/addresses'); setAddresses(data.addresses); setRecords(data.addresses as unknown as Record<string, unknown>[]); setAddressFormOpen(false); setEditingAddressId(''); setAddress(blankAddress); setNotice(editingAddressId ? 'Address updated.' : 'Address saved.') })}><Field label={text("Address label")}><input maxLength={40} value={address.label} onChange={(e) => setAddress({ ...address, label: e.target.value })} /></Field>{[['recipientName', 'Full name'], ['phone', 'Phone'], ['line1', 'Address'], ['line2', 'Apartment or suite'], ['division', 'Division'], ['district', 'District'], ['area', 'Area / Thana / Upazila'], ['city', 'City'], ['region', 'Region'], ['postalCode', 'Postal code'], ['countryCode', 'Country code']].map(([key, label]) => <Field key={key} label={label}><input required={['recipientName','phone','line1','city','countryCode'].includes(key)} value={address[key as keyof typeof address] as string} onChange={(e) => setAddress({ ...address, [key]: e.target.value })} /></Field>)}<label className="account-check"><input type="checkbox" checked={address.isDefaultShipping} onChange={(e) => setAddress({ ...address, isDefaultShipping: e.target.checked })} /> {text("Default delivery")}</label><label className="account-check"><input type="checkbox" checked={address.isDefaultBilling} onChange={(e) => setAddress({ ...address, isDefaultBilling: e.target.checked })} /> {text("Default billing")}</label><Button disabled={busy}>{editingAddressId ? text("Update address") : text("Save address")}</Button></form>}{addresses.length ? addresses.map((item) => <article className="account-record" key={item._id}><div><strong>{item.label || item.recipientName}</strong><p>{[item.line1, item.line2, item.area, item.district, item.division, item.city, item.region, item.postalCode, item.countryCode].filter(Boolean).join(', ')}</p><small>{item.isDefaultShipping ? text("Default delivery") : ''}{item.isDefaultBilling ? ' · Default billing' : ''}</small></div><div className="account-record__actions"><button className="account-text-button" onClick={() => editAddress(item)}>{text("Edit")}</button><button className="account-text-button" disabled={busy} onClick={() => void removeAddress(item._id)}>{text("Remove")}</button></div></article>) : <Empty title={text("No saved addresses")} detail={text("Add an address to make your next order easier.")} />}</div>}
        {['Orders','Wishlist','Notifications'].includes(section)&&(recordsLoading?<WorkspaceSkeleton/>:<RecordList section={section} records={records}/>)}
      </section>
    </div><footer className="account-footer"><a href="/">{text("Return to the collection")}</a><span>{text("Private, considered, and made for you.")}</span></footer>
  </main>

  return <main className="account-page"><header className="account-top"><a href="/" className="account-wordmark">{storeName}</a><a className="account-top__link" href="/">{text("Return to the collection")}<span aria-hidden="true">↗</span></a></header><div className="account-auth"><aside className="account-editorial"><div className="account-editorial__image" role="img" aria-label="Fashion portrait in warm natural light" /><div className="account-editorial__shade" /><div className="account-editorial__copy"><p className="account-kicker">{text("A considered wardrobe")}</p><p className="account-editorial__quote">{text("Good things")}<br /><em>{text("stay with you.")}</em></p><span>{text("Thoughtful form. Lasting presence.")}</span></div></aside><section className="account-auth__form-wrap"><div className="account-auth__form"><p className="account-kicker">{text("Your personal space")}</p><h1>{text(pageTitle)}</h1><p className="account-auth__lead">{path.includes('register') ? text("Create an account to save your details and follow every order.") : text(adminEntry?'Sign in to manage your store.':'Sign in to continue to your considered collection.')}</p>
    {error && <p className="account-alert account-alert--error" role="alert">{error}</p>}{notice && <p className="account-alert" role="status">{notice}</p>}
    {path.endsWith('/register') ? <form className="account-form" onSubmit={(event) => submit(event, async () => { const form = new FormData(event.currentTarget); const data = await request<{ verificationRequired: boolean }>('/auth/register', { method: 'POST', body: JSON.stringify({ name: form.get('name'), email: form.get('email'), password: form.get('password') }) }, ''); setNotice(data.verificationRequired ? 'Check your inbox for a verification link before signing in.' : 'Account created.') })}><Field label={text("Full name")}><input name="name" autoComplete="name" required maxLength={100} /></Field><Field label={text("Email address")}><input name="email" type="email" autoComplete="email" required /></Field><Field label={text("Password")}><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required /><small>{text("At least 12 characters.")}</small></Field><Button disabled={busy}>{busy ? text("Creating account…") : text("Create account")}</Button><p className="account-form__switch">{text("Already have an account?")}<a href="/account/sign-in">{text("Sign in")}</a></p></form>
      : path.endsWith('/forgot-password') ? <form className="account-form" onSubmit={(event) => submit(event, async () => { const form = new FormData(event.currentTarget); await request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: form.get('email') }) }, ''); setNotice(text("If an account matches that address, reset instructions will be sent.")) })}><Field label={text("Email address")}><input name="email" type="email" autoComplete="email" required /></Field><Button disabled={busy}>{busy ? text("Sending…") : text("Send reset link")}</Button><a className="account-form__back" href="/account/sign-in">{text("Back to sign in")}</a></form>
      : path.endsWith('/reset-password') ? <form className="account-form" onSubmit={(event) => submit(event, async () => { const form = new FormData(event.currentTarget); await request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: new URLSearchParams(window.location.search).get('token'), password: form.get('password') }) }, ''); setNotice(text("Password updated. You can now sign in.")) })}><Field label={text("New password")}><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required /></Field><Button disabled={busy}>{busy ? text("Updating…") : text("Reset password")}</Button></form>
      : path.endsWith('/verify-email') ? <div className="account-form"><p>{text("Confirming this email address lets us secure your account and keep you updated on your orders.")}</p><Button disabled={busy} onClick={() => { setBusy(true); request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: new URLSearchParams(window.location.search).get('token') }) }, '').then(() => setNotice(text("Email verified. You can sign in now."))).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Verification failed.')).finally(() => setBusy(false)) }}>{busy ? text("Verifying…") : text("Verify email")}</Button></div>
      : <form className="account-form" onSubmit={(event) => submit(event, async () => { const form = new FormData(event.currentTarget); const data = await request<{ accessToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) }, ''); await installSession(data.accessToken) })}><Field label={text("Email address")}><input name="email" type="email" autoComplete="email" required /></Field><Field label={text("Password")}><input name="password" type="password" autoComplete="current-password" required /></Field><div className="account-form__meta"><a href="/account/forgot-password">{text("Forgot password?")}</a><button type="button" className="account-inline-link" onClick={async (event) => { const form = event.currentTarget.form; const email = new FormData(form ?? undefined).get('email'); if (typeof email !== 'string' || !email) { setError(text("Enter your email address first.")); return } setBusy(true); setError(''); try { await request('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }, ''); setNotice(text("If this address needs verification, instructions will be sent.")) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to resend instructions.') } finally { setBusy(false) } }}>{text("Resend verification")}</button></div><Button disabled={busy}>{busy ? text("Signing in…") : text("Sign in")} <span aria-hidden="true">↗</span></Button><p className="account-form__switch">{text("New to the collection?")}<a href="/account/register">{text("Create an account")}</a></p></form>}
    </div></section></div><footer className="account-footer"><span>© {new Date().getFullYear()} {storeName}</span><span>{text("Privacy · Terms · Client care")}</span></footer></main>
}

function Field({ label, children }: { label: string; children: ReactNode }) { const text=useInterfaceText();return <label className="account-field"><span>{text(label)}</span>{children}</label> }
function Button({ children, disabled, onClick, variant }: { children: ReactNode; disabled?: boolean; onClick?: () => void; variant?: string }) { return <DesignButton type={onClick?'button':'submit'} className="account-button" variant={variant==='secondary'?'secondary':'primary'} disabled={disabled} onClick={onClick}>{children}</DesignButton> }
function Empty({ title, detail }: { title: string; detail: string }) { const text=useInterfaceText();return <WorkspaceEmpty title={text(title)} detail={text(detail)} action={<a className="button button--secondary" href="/shop">{text('Return to the collection')}</a>}/> }
function RecordList({ section, records }: { section: string; records: Record<string, unknown>[] }) {
  const text=useInterfaceText();const {locale}=useI18n()
  const content = useMemo(() => records.map((record, index) => {
    const title = String(record.orderNumber || record.name || record.type || record.templateKey || `${section} item`)
    const detail = section === 'Orders' ? new Intl.NumberFormat(locale==='bn'?'bn-BD':'en-BD',{style:'currency',currency:String(record.currency||'BDT')}).format(Number(record.grandTotal)/100) : section === 'Wishlist' ? String(record.slug || 'Saved piece') : new Date(String(record.createdAt || Date.now())).toLocaleDateString(locale==='bn'?'bn-BD':'en-BD')
    return <article className="account-record" key={String(record._id || index)}><span className="account-record__icon"><Icon name={section==='Orders'?'bag':'document'}/></span><div><strong>{section === 'Orders' && record._id ? <a href={`/orders/${String(record._id)}`}>{title}</a> : title}</strong><p>{detail}</p>{section==='Orders'&&<StatusBadge status={String(record.status)}/>}</div>{section === 'Orders' && record._id ? <a className="account-record__link" href={`/orders/${String(record._id)}`} aria-label={`${text('View order')} ${title}`}>{text('View order')} ↗</a> : null}</article>
  }), [records, section,locale,text])
  return records.length ? <div className="account-list">{content}</div> : <Empty title={`No ${section.toLowerCase()} yet`} detail={section === 'Orders' ? 'Your order history will appear here after your first purchase.' : section === 'Wishlist' ? 'Save a piece you love and it will be waiting here.' : 'You are all caught up. Account updates will appear here.'} />
}
