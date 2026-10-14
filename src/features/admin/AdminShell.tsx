import { fetchWithSession } from '../../lib/session'
import { useInterfaceText } from '../../i18n/interface-text'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Button } from '../../components/ui'

import { getAccessToken } from '../../lib/session'
import { LanguageSwitcher } from '../../i18n/I18nProvider'
import { Icon, type IconName } from '../../components/Icon'
import { WorkspaceSkeleton } from '../../components/WorkspaceUI'
import { useBusinessConfig } from '../storefront/StorefrontConfig'
import { absoluteStorefrontUrl,setPageMetadata } from '../../lib/seo'
import Trash, { AdminManagementAccess } from './AdminManagement'
import './admin-shell.css'

const Dashboard = lazy(() => import('./AdminDashboardExperience'))
const Products = lazy(() => import('./AdminProductsExperience'))
const Orders = lazy(() => import('./AdminOrdersExperience'))
const Media = lazy(() => import('./AdminMediaExperience'))
const Builder = lazy(() => import('./AdminPageBuilderExperience'))
const Theme = lazy(() => import('./AdminThemeExperience'))
const Content = lazy(() => import('./AdminContentExperience'))
const Couriers = lazy(() => import('./AdminCourierExperience'))
const Delivery = lazy(() => import('./AdminDeliveryExperience'))

const sections = [
  { key: 'dashboard', label: 'Overview', href: '/admin', group: 'Workspace' },
  { key: 'analytics', label: 'Business analytics', href: '/admin?view=analytics', group: 'Workspace' },
  { key: 'products', label: 'Products', href: '/admin/products', group: 'Commerce' },
  { key: 'orders', label: 'Orders', href: '/admin/orders', group: 'Commerce' },
  { key: 'customers', label: 'Customers', href: '/admin?view=customers', group: 'Commerce' },
  { key: 'inventory', label: 'Inventory', href: '/admin?view=inventory', group: 'Commerce' },
  { key: 'coupons', label: 'Coupons', href: '/admin?view=coupons', group: 'Commerce' },
  { key: 'promotions', label: 'Promotions', href: '/admin?view=promotions', group: 'Commerce' },
  { key: 'media', label: 'Media library', href: '/admin/media', group: 'Storefront' },
  { key: 'pages', label: 'Homepage builder', href: '/admin/pages', group: 'Storefront' },
  { key: 'theme', label: 'Theme studio', href: '/admin/theme', group: 'Storefront' },
  { key: 'content', label: 'Pages & policies', href: '/admin/content', group: 'Storefront' },
  { key: 'trash', label: 'Trash', href: '/admin?view=trash', group: 'Commerce' },
  { key: 'settings', label: 'Settings', href: '/admin?view=settings', group: 'Configuration' },
  { key: 'payments', label: 'Payment settings', href: '/admin/payments', group: 'Configuration' },
  { key: 'delivery', label: 'Delivery & shipping', href: '/admin/delivery', group: 'Configuration' },
  { key: 'couriers', label: 'Courier settings', href: '/admin/couriers', group: 'Configuration' },
] as const

type LocationState = { pathname: string; search: string }
type ApiResult<T> = { success: boolean; data?: T }
const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
const navigationIcons:Record<string,IconName> = { dashboard:'grid',analytics:'chart',products:'bag',orders:'document',customers:'user',inventory:'box',coupons:'tag',promotions:'sparkle',media:'image',pages:'grid',theme:'palette',content:'document',settings:'settings',payments:'settings',delivery:'truck',couriers:'truck',trash:'box' }

function currentLocation(): LocationState { return { pathname: window.location.pathname, search: window.location.search } }
function routeKey(location: LocationState): string {
  const path = location.pathname.replace(/\/$/, '') || '/admin'
  if (path === '/admin') return new URLSearchParams(location.search).get('view') || 'dashboard'
  const aliases: Record<string, string> = { '/admin/analytics': 'analytics', '/admin/customers': 'customers', '/admin/inventory': 'inventory', '/admin/coupons': 'coupons', '/admin/promotions': 'promotions', '/admin/settings': 'settings' }
  if (aliases[path]) return aliases[path]!
  if (path.startsWith('/admin/products')) return 'products'
  if (path.startsWith('/admin/orders')) return 'orders'
  return ({ '/admin/media': 'media', '/admin/pages': 'pages', '/admin/theme': 'theme', '/admin/content': 'content', '/admin/couriers': 'couriers', '/admin/delivery': 'delivery','/admin/payments':'payments' } as Record<string, string>)[path] || 'dashboard'
}

function sectionTitle(key: string): string { return sections.find((section) => section.key === key)?.label || 'Overview' }
function authHeaders(token: string): Headers {
  const headers = new Headers({ Authorization: `Bearer ${token}` })
  if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
  return headers
}

export default function AdminShell() {
  const text = useInterfaceText()
  const {config,settings}=useBusinessConfig()
  const brandName=settings.displayName||config.name
  const [collapsed,setCollapsed]=useState(false)
  const [operator,setOperator]=useState({name:'',role:''})
  const sidebarRef=useRef<HTMLElement>(null)
  const workspaceRef=useRef<HTMLDivElement>(null)
  const menuRef=useRef<HTMLButtonElement>(null)

  const [location, setLocation] = useState(currentLocation)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authState, setAuthState] = useState<'checking' | 'allowed' | 'denied'>('checking')
  const [authMessage, setAuthMessage] = useState('Checking administrator access…')
  const activeKey = routeKey(location)
  const title = sectionTitle(activeKey)
  useEffect(()=>{const updated=(event:Event)=>{const name=(event as CustomEvent<{name:string}>).detail?.name;if(name)setOperator(value=>({...value,name}))};window.addEventListener('admin-profile-updated',updated);return()=>window.removeEventListener('admin-profile-updated',updated)},[])
  const groups = useMemo(() => Array.from(new Set(sections.map((section) => section.group))), [])
  useEffect(()=>{setPageMetadata({title:`${text(title)} · ${brandName}`,description:text('Store workspace'),canonical:absoluteStorefrontUrl(location.pathname),robots:'noindex,nofollow'})},[title,brandName,text,location.pathname])

  useEffect(() => {
    const onPopState = () => {
      if (!window.location.pathname.startsWith('/admin')) { window.location.reload(); return }
      setLocation(currentLocation())
      setMobileOpen(false)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    let alive = true
    getAccessToken().then(async (token) => {
      if (!token) throw new Error('Sign in with an administrator account to continue.')
      const response = await fetchWithSession(`${apiBase}/auth/me`, { headers: authHeaders(token), credentials: 'include' })
      const result = await response.json() as ApiResult<{ user: { role: string; name:string } }>
      if (!response.ok || !['super_admin', 'admin', 'manager', 'staff'].includes(result.data?.user.role || '')) throw new Error('This account does not have admin access.')
      if (alive) { setAuthState('allowed'); setOperator(result.data!.user) }
    }).catch((cause: unknown) => {
      if (alive) { setAuthMessage(cause instanceof Error ? cause.message : 'Administrator access is unavailable.'); setAuthState('denied') }
    })
    return () => { alive = false }
  }, [])

  useEffect(()=>{
    const media=window.matchMedia('(max-width:760px)')
    const update=()=>{if(sidebarRef.current)sidebarRef.current.inert=media.matches&&!mobileOpen;if(workspaceRef.current)workspaceRef.current.inert=media.matches&&mobileOpen}
    update();media.addEventListener('change',update)
    if(mobileOpen){document.body.classList.add('admin-nav-open');sidebarRef.current?.querySelector<HTMLElement>('a')?.focus()}
    const keydown=(event:KeyboardEvent)=>{
      if(!mobileOpen)return
      if(event.key==='Escape'){setMobileOpen(false);menuRef.current?.focus()}
      if(event.key==='Tab'){
        const links=[...(sidebarRef.current?.querySelectorAll<HTMLElement>('a,button')||[])].filter(element=>element.getClientRects().length>0);const first=links[0],last=links.at(-1)
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
      }
    }
    document.addEventListener('keydown',keydown)
    return()=>{media.removeEventListener('change',update);document.removeEventListener('keydown',keydown);document.body.classList.remove('admin-nav-open');if(workspaceRef.current)workspaceRef.current.inert=false;if(mobileOpen)menuRef.current?.focus()}
  },[mobileOpen,authState])

  const onShellClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    const anchor = target.closest('a')
    if (!anchor || anchor.target === '_blank' || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const url = new URL(anchor.href, window.location.href)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/admin')) return
    event.preventDefault()
    if (`${url.pathname}${url.search}` !== `${window.location.pathname}${window.location.search}`) {
      window.history.pushState({}, '', `${url.pathname}${url.search}`)
      setLocation(currentLocation())
    }
    setMobileOpen(false)
  }

  const page = activeKey === 'trash' ? <Trash /> : activeKey === 'products' ? <Products />
    : activeKey === 'orders'||activeKey==='payments' ? <Orders paymentSettingsOnly={activeKey==='payments'} />
      : activeKey === 'media' ? <Media />
        : activeKey === 'pages' ? <Builder />
          : activeKey === 'theme' ? <Theme />
            : activeKey === 'content' ? <Content />
              : activeKey === 'couriers' ? <Couriers />
                : activeKey === 'delivery' ? <Delivery />
                : <Dashboard activeView={activeKey} />

  if (authState === 'checking') return <main className="admin-shell-auth"><WorkspaceSkeleton kind="dashboard" /></main>
  if (authState === 'denied') return <main className="admin-shell-auth"><p className="account-kicker">{brandName} · Admin</p><h1>{text("Admin access")}</h1><p role="alert">{text(authMessage)}</p><Button onClick={() => window.location.assign('/account/sign-in?returnTo='+encodeURIComponent(window.location.pathname+window.location.search))}>{text("Sign in")}</Button><a href="/">{text("Return to storefront ↗")}</a></main>

  return <AdminManagementAccess.Provider value={['admin','super_admin','manager'].includes(operator.role)}><div className={`admin-shell${collapsed?' admin-shell--collapsed':''}`} onClick={onShellClick}>
    {mobileOpen && <button className="admin-shell__scrim" aria-label={text("Close navigation")} onClick={() => setMobileOpen(false)} />}
    <aside ref={sidebarRef} className={`admin-shell__sidebar ${mobileOpen ? 'is-open' : ''}`} aria-label={text("Admin sidebar")}>
      <button className="admin-sidebar-close" aria-label={text('Close admin navigation')} onClick={()=>{setMobileOpen(false);menuRef.current?.focus()}}><Icon name="close"/></button>
      <a className="admin-shell__brand" href="/admin"><span className="admin-brand-mark">{settings.logoUrl?<img src={settings.logoUrl} alt=""/>:brandName.charAt(0)}</span><span className="admin-brand-copy">{brandName}<small>{text("Commerce admin")}</small></span></a>
      <nav className="admin-shell__nav" aria-label={text("Admin navigation")}>
        {groups.map((group) => <div className="admin-shell__group" key={group}><p>{text(group)}</p>{sections.filter((section) => section.group === group).map((section) => <a key={section.key} href={section.href} title={text(section.label)} className={activeKey === section.key ? 'is-active' : ''} aria-current={activeKey === section.key ? 'page' : undefined}><Icon name={navigationIcons[section.key]}/><span>{text(section.label)}</span></a>)}</div>)}
      </nav>
      <div className="admin-shell__bottom"><a href="/"><Icon name="arrow"/><span>{text("View storefront")}</span></a><button className="admin-collapse" type="button" onClick={()=>setCollapsed(value=>!value)} title={text(collapsed?'Expand navigation':'Collapse navigation')}><Icon name="menu"/><span>{text(collapsed?'Expand navigation':'Collapse navigation')}</span></button></div>
    </aside>
    <div ref={workspaceRef} className="admin-shell__workspace">
      <header className="admin-shell__header"><div className="admin-shell__heading"><button ref={menuRef} className="admin-shell__menu" type="button" aria-label={text(mobileOpen?'Close admin navigation':'Open admin navigation')} aria-expanded={mobileOpen} onClick={()=>setMobileOpen(open=>!open)}><Icon name={mobileOpen?'close':'menu'}/></button><div><p className="account-kicker">{brandName} · {text('Store workspace')}</p><h1>{text(title)}</h1></div></div><div className="admin-shell__tools"><LanguageSwitcher compact/><a href="/" className="admin-shell__storefront">{text('View storefront')} ↗</a><a href="/account" className="admin-operator" title={operator.name}><span>{operator.name.charAt(0)||'A'}</span><small>{text('Account')}</small></a></div></header>
      <main className="admin-shell__content"><Suspense fallback={<WorkspaceSkeleton kind={activeKey==='dashboard'?'dashboard':'table'}/>}>{page}</Suspense></main>
    </div>
  </div></AdminManagementAccess.Provider>
}
