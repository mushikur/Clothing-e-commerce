import { fetchWithSession } from '../../lib/session'
import { useCallback, useEffect, useState, type FormEvent, lazy, Suspense } from 'react'
import { Icon } from '../../components/Icon'
import { Button, Drawer, EmptyState, IconButton, Input, Loading } from '../../components/ui'
import { useBusinessConfig } from './StorefrontConfig'
import { getAccessToken } from '../../lib/session'
import { guestCartCount, type CartPreview } from '../../lib/guest-cart'
import { safeHref, safeWebUrl } from '../../lib/safe-url'
import './customer-site.css'
import { ExperienceSkeleton } from '../../components/Experience'
import { LanguageSwitcher, useI18n } from '../../i18n/I18nProvider'
import { useReducedMotion, setReducedMotionPreference } from '../../lib/motion'

const MiniCartContents=lazy(()=>import('../cart/MiniCartContents'))
const ProductCatalog = lazy(() => import('../catalog/ProductCatalog'))
const HomeExperience = lazy(() => import('./HomeExperience'))
const WishlistExperience = lazy(() => import('../account/WishlistExperience'))
const BrandPage = lazy(() => import('./BrandPage'))
const OrderExperience = lazy(() => import('../account/OrderExperience'))
const LandingPageExperience = lazy(() => import('./LandingPageExperience'))
const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type ApiResult<T> = { success: boolean; data?: T }
type SearchSuggestion = { _id: string; slug: string; name: string; price: number; discountPercent?: number; currency?: string; translations?: { en?: { name?: string }; bn?: { name?: string } }; media?: Array<{ kind?: string; url?: string; alt?: string }> }
const recentSearchesKey = `fashion-recent-searches:${import.meta.env.VITE_BUSINESS_SLUG || 'store'}`

export function SiteHeader({ cartCount, wishlistCount }: { cartCount: number; wishlistCount: number }) {
  const { config, settings } = useBusinessConfig()
  const { locale, t } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { const value = JSON.parse(localStorage.getItem(recentSearchesKey) || '[]'); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 4) : [] } catch { return [] }
  })
  useEffect(() => {
    const handleAdded = (event: Event) => {
      const item = (event as CustomEvent<CartPreview>).detail
      if (!item?.name) return

      setCartOpen(true)
    }
    window.addEventListener('storefront-cart-item-added', handleAdded)
    return () => window.removeEventListener('storefront-cart-item-added', handleAdded)
  }, [])
  useEffect(() => {
    const query = search.trim()
    if (!searchOpen || query.length < 2) { setSearchSuggestions([]); setSearchLoading(false); return }
    let alive = true
    const controller = new AbortController()
    setSearchLoading(true)
    const timer = window.setTimeout(() => {
      const headers = new Headers()
      if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
      fetchWithSession(`${apiBase}/products?${new URLSearchParams({ q: query, limit: '4' })}`, { headers, credentials: 'include', signal: controller.signal }).then((response) => response.json() as Promise<ApiResult<SearchSuggestion[]>>).then((result) => {
        if (alive) setSearchSuggestions((result.data || []).map((product) => ({ ...product, name: product.translations?.[locale]?.name || product.translations?.en?.name || product.name })))
      }).catch(() => { if (alive) setSearchSuggestions([]) }).finally(() => { if (alive) setSearchLoading(false) })
    }, 240)
    return () => { alive = false; controller.abort(); window.clearTimeout(timer) }
  }, [locale, search, searchOpen])
  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    const query = search.trim()
    if (!query) return
    const next = [query, ...recentSearches.filter((entry) => entry.toLocaleLowerCase() !== query.toLocaleLowerCase())].slice(0, 4)
    setRecentSearches(next)
    try { localStorage.setItem(recentSearchesKey, JSON.stringify(next)) } catch { /* Search navigation does not depend on local history. */ }
    window.location.assign(`/search?q=${encodeURIComponent(query)}`)
    setSearchOpen(false)
  }
  const closeMenu = () => setMenuOpen(false)
  return <>
    <div className="site-announcement"><span>{t('header.announcement')}</span><a href="/shop">{t('header.discover')} <Icon name="arrow" /></a></div>
    <header className="site-header"><div className="container site-header__inner">
      <div className="header-mobile-menu"><IconButton icon="menu" label={t('header.openMenu')} onClick={() => setMenuOpen(true)} /></div>
      <a className="brand" href="/" aria-label={`${config.name} home`}>{safeWebUrl(settings.logoUrl) ? <img className="brand__logo" src={safeWebUrl(settings.logoUrl)} alt="" decoding="async" /> : <span className="brand__symbol" aria-hidden="true">{config.name.slice(0, 1).toUpperCase()}</span>}<span>{config.name}</span></a>
      <nav className="desktop-nav" aria-label="Main navigation"><a className="nav-link" href="/shop">{t('common.shop')}</a><a className="nav-link" href="/shop?sort=newest">{t('common.newArrivals')}</a><a className="nav-link" href="/about">{t('common.about')}</a><a className="nav-link" href="/contact">{t('common.contact')}</a></nav>
      <div className="header-actions"><LanguageSwitcher compact locales={settings.enabledLocales} /><IconButton icon="search" label={t('common.searchProducts')} onClick={() => setSearchOpen(true)} /><a href="/account" aria-label={t('header.accountLabel')}><Icon name="user" /></a><a href="/wishlist" aria-label={`${t('header.wishlistLabel')}, ${wishlistCount} ${t('header.items')}`}><Icon name="heart" />{wishlistCount > 0 && <span key={`wishlist-${wishlistCount}`} className="header-count">{wishlistCount}</span>}</a><IconButton data-cart-target icon="bag" label={`${t('common.cart')}, ${cartCount} ${t('header.items')}`} onClick={() => setCartOpen(true)}><span key={`cart-${cartCount}`} className="header-count">{cartCount}</span></IconButton></div>
      <div className="header-mobile-actions"><LanguageSwitcher compact locales={settings.enabledLocales} /><IconButton icon="search" label={t('common.searchProducts')} onClick={() => setSearchOpen(true)} /><IconButton data-cart-target icon="bag" label={`${t('common.cart')}, ${cartCount} ${t('header.items')}`} onClick={() => setCartOpen(true)}><span key={`mobile-cart-${cartCount}`} className="header-count">{cartCount}</span></IconButton><a href="/account" aria-label={t('header.accountLabel')}><Icon name="user" /></a></div>
    </div></header>
    <Drawer open={menuOpen} onClose={closeMenu} title={t('common.explore')} side="left"><nav className="mobile-nav" aria-label={t('common.explore')}><a href="/shop" onClick={closeMenu}>{t('common.shop')} <Icon name="arrow" /></a><a href="/shop?sort=newest" onClick={closeMenu}>{t('common.newArrivals')} <Icon name="arrow" /></a><a href="/about" onClick={closeMenu}>{t('common.about')} <Icon name="arrow" /></a><a href="/faq" onClick={closeMenu}>{t('policy.faq')} <Icon name="arrow" /></a><LanguageSwitcher locales={settings.enabledLocales} /><div className="mobile-nav__secondary"><a href="/account" onClick={closeMenu}>{t('common.account')}</a><a href="/wishlist" onClick={closeMenu}>{t('common.wishlist')}</a><a href="/contact" onClick={closeMenu}>{t('common.contact')}</a></div></nav></Drawer>
    <Drawer open={searchOpen} onClose={() => setSearchOpen(false)} title={t('header.findPiece')}><form className="site-search-form" onSubmit={submitSearch}><Input autoFocus label={t('header.searchCollection')} placeholder={t('header.trySearch')} value={search} onChange={(event) => setSearch(event.target.value)} /><Button disabled={!search.trim()}>{t('common.search')} <Icon name="arrow" /></Button></form>{search.trim().length >= 2 ? <section className="search-suggestions" aria-live="polite">{searchLoading ? <ExperienceSkeleton kind="search" count={3} /> : searchSuggestions.length ? searchSuggestions.map((product) => { const image = product.media?.find((media) => media.kind === 'image')?.url; const amount = product.price / 100 * (100 - (product.discountPercent || 0)) / 100; let price = `${amount.toFixed(2)} ${product.currency || config.currency}`; try { price = new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', { style: 'currency', currency: product.currency || config.currency }).format(amount) } catch { /* Keep the clear currency fallback. */ } return <a className="search-suggestion-product" href={`/products/${product.slug}`} key={product._id} onClick={() => setSearchOpen(false)}>{image && <img src={safeWebUrl(image) || ''} alt="" loading="lazy" decoding="async" />}<span><strong>{product.name}</strong><small>{price}</small></span><Icon name="arrow" /></a> }) : <div className="search-no-results"><strong>{t('header.searchNoResults')}</strong><p>{t('header.searchNoResultsHelp')}</p><a href="/shop?sort=newest" onClick={() => setSearchOpen(false)}>{t('common.newArrivals')} <Icon name="arrow" /></a></div>}</section> : <div className="search-suggestions">{recentSearches.length > 0 && <><p className="eyebrow">{t('header.recentSearches')}</p>{recentSearches.map((term) => <a key={term} href={`/search?q=${encodeURIComponent(term)}`} onClick={() => setSearchOpen(false)}>{term}<Icon name="arrow" /></a>)}</>}<p className="eyebrow">{t('header.popularSearches')}</p>{[t('common.newArrivals'), t('header.clothing'), t('header.bestSellers')].map((item, index) => <a key={item} href={index === 0 ? '/shop?sort=newest' : '/shop'} onClick={() => setSearchOpen(false)}>{item}<Icon name="arrow" /></a>)}</div>}</Drawer>
    <Drawer open={cartOpen} onClose={() => setCartOpen(false)} title={`${t('common.cart')} · ${cartCount}`}><div className="cart-drawer-content">{cartCount ? <><Suspense fallback={<ExperienceSkeleton kind="cart" count={2}/>}><MiniCartContents revision={cartCount}/></Suspense><p className="cart-drawer-content__note" role="status">{t('delight.bagTitle')}</p><Button size="lg" onClick={() => window.location.assign('/checkout')}>{t('delight.checkout')} <Icon name="arrow" /></Button><Button size="lg" className="cart-checkout" onClick={() => window.location.assign('/cart')}>{t('header.reviewBag')} <Icon name="arrow" /></Button><Button variant="text" className="cart-continue" onClick={() => setCartOpen(false)}>{t('header.continueShopping')}</Button></> : <EmptyState title={t('header.bagPause')} description={t('header.bagEmpty')} action={<Button onClick={() => { setCartOpen(false); window.location.assign('/shop') }}>{t('header.collection')}</Button>} />}</div></Drawer>
  </>
}

export function SiteFooter() {
  const reducedMotion = useReducedMotion()
  const { config, settings } = useBusinessConfig()
  const { t } = useI18n()
  return <footer className="site-footer"><div className="container"><div className="footer-main"><div className="footer-brand"><a className="brand" href="/" aria-label={`${config.name} home`}>{safeWebUrl(settings.logoUrl) ? <img className="brand__logo" src={safeWebUrl(settings.logoUrl)} alt="" decoding="async" /> : <span className="brand__symbol" aria-hidden="true">{config.name.slice(0, 1).toUpperCase()}</span>}<span>{config.name}</span></a><p>{settings.contact?.address || t('footer.tagline')}</p>{(settings.socialLinks?.length ? settings.socialLinks : config.instagramUrl ? [{ platform: 'Instagram', url: config.instagramUrl }] : []).map((link) => <a className="footer-instagram" href={safeHref(link.url) || '#'} target="_blank" rel="noopener noreferrer" key={link.platform}>{link.platform} <Icon name="arrow" /></a>)}</div><div className="footer-links"><div><span className="eyebrow">{t('footer.explore')}</span><a href="/shop">{t('footer.shopAll')}</a><a href="/shop?sort=newest">{t('common.newArrivals')}</a><a href="/about">{t('common.about')}</a><a href="/faq">{t('policy.faq')}</a></div><div><span className="eyebrow">{t('footer.account')}</span><a href="/account">{t('footer.profile')}</a><a href="/account?section=Orders">{t('footer.orders')}</a><a href="/wishlist">{t('common.wishlist')}</a><a href="/contact">{t('common.contact')}</a></div><div><span className="eyebrow">{t('footer.information')}</span><a href="/privacy">{t('footer.privacy')}</a><a href="/terms">{t('footer.terms')}</a><a href="/returns">{t('footer.returns')}</a><a href="/shipping">{t('footer.shipping')}</a>{config.supportEmail ? <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a> : <span className="footer-muted">{t('footer.pending')}</span>}</div></div></div><div className="footer-bottom"><button className="footer-motion" aria-pressed={reducedMotion} onClick={() => setReducedMotionPreference(!reducedMotion)}><span aria-hidden="true" />{t('delight.reduceMotion')}</button><span>© {new Date().getFullYear()} {config.name}</span><span>{settings.contact?.phone || t('footer.storeInfo')}</span></div></div></footer>
}

function CatalogPage({ pathname, onCartCountChange, onWishlistCountChange }: { pathname: string; onCartCountChange: (count: number) => void; onWishlistCountChange: (count: number) => void }) {
  const { t } = useI18n()
  const pageType = pathname.startsWith('/search') ? t('common.search') : pathname.startsWith('/category/') ? t('catalog.category') : pathname.startsWith('/subcategory/') ? t('catalog.subcategory') : t('common.shop')
  const slug = pathname.split('/').filter(Boolean).at(-1)
  const searchPage = pathname.startsWith('/search')
  const heading = searchPage ? `${t('catalog.searchHeading')}${new URLSearchParams(window.location.search).get('q') ? `: “${new URLSearchParams(window.location.search).get('q')}”` : ''}` : pathname.startsWith('/category/') || pathname.startsWith('/subcategory/') ? (slug || 'Collection').split('-').map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ') : t('catalog.collection')
  const sort = new URLSearchParams(window.location.search).get('sort') || 'newest'
  return <section className="section catalog-page"><div className="container"><nav className="product-breadcrumb" aria-label="Breadcrumb"><a href="/">{t('common.home')}</a><span>/</span><span aria-current="page">{pageType}</span></nav><div className="section-heading catalog-page__heading"><div><p className="eyebrow">{searchPage ? t('catalog.searchEyebrow') : t('catalog.eyebrow')}</p><h1>{heading}</h1></div><p>{t('catalog.intro')}</p></div><Suspense fallback={<div className="catalog-loading"><Loading label={t('catalog.finding')} /></div>}><ProductCatalog onCartCountChange={onCartCountChange} onWishlistCountChange={onWishlistCountChange} initialSort={sort} /></Suspense></div></section>
}

export default function CustomerSite() {
  const [cartCount, setCartCount] = useState(() => guestCartCount())
  const [wishlistCount, setWishlistCount] = useState(0)
  const { t } = useI18n()
  const pathname = window.location.pathname
  const cartChanged = useCallback((count: number) => setCartCount(count), [])
  const wishlistChanged = useCallback((count: number) => setWishlistCount(count), [])
  useEffect(() => {
    const updateGuestCount = (event: Event) => {
      const count = (event as CustomEvent<{ count: number }>).detail?.count
      setCartCount(typeof count === 'number' ? count : guestCartCount())
    }
    const wishlistCountChanged = (event: Event) => setWishlistCount((event as CustomEvent<{ count: number }>).detail.count)
    window.addEventListener('storefront-wishlist-count', wishlistCountChanged)
    window.addEventListener('storefront-cart-count', updateGuestCount)
    window.addEventListener('guest-cart-change', updateGuestCount)
    return () => { window.removeEventListener('guest-cart-change', updateGuestCount); window.removeEventListener('storefront-cart-count', updateGuestCount); window.removeEventListener('storefront-wishlist-count', wishlistCountChanged) }
  }, [])
  useEffect(() => {
    let alive = true
    getAccessToken().then(async (token) => {
      if (!token) return
      const privateHeaders = new Headers({ Authorization: `Bearer ${token}` })
      if (import.meta.env.VITE_BUSINESS_SLUG) privateHeaders.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
      const [cartResponse, wishlistResponse] = await Promise.all([fetchWithSession(`${apiBase}/cart`, { headers: privateHeaders, credentials: 'include' }), fetchWithSession(`${apiBase}/users/me/wishlist`, { headers: privateHeaders, credentials: 'include' })])
      if (!cartResponse.ok || !wishlistResponse.ok) return
      const [cart, wishlist] = await Promise.all([cartResponse.json() as Promise<ApiResult<{ items: Array<{ quantity: number }> }>>, wishlistResponse.json() as Promise<ApiResult<{ products: unknown[] }>>])
      if (alive) { setCartCount(cart.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0); setWishlistCount(wishlist.data?.products.length ?? 0) }
    }).catch(() => undefined)
    return () => { alive = false }
  }, [])

  let content
  if (pathname === '/') content = <HomeExperience onCartCountChange={cartChanged} onWishlistCountChange={wishlistChanged} />
  else if (pathname === '/shop' || pathname === '/search' || pathname.startsWith('/category/') || pathname.startsWith('/subcategory/')) content = <CatalogPage pathname={pathname} onCartCountChange={cartChanged} onWishlistCountChange={wishlistChanged} />
  else if (pathname === '/wishlist') content = <WishlistExperience onCartCountChange={cartChanged} onWishlistCountChange={wishlistChanged} />
  else if (pathname === '/about' || pathname === '/contact' || pathname === '/faq' || pathname === '/policies' || ['/privacy', '/terms', '/returns', '/refunds', '/shipping'].includes(pathname)) content = <BrandPage page={pathname.slice(1)} />
  else if (pathname === '/orders') { window.location.replace('/account?section=Orders'); content = null }
  else if (pathname.startsWith('/orders/')) content = <OrderExperience />
  else if (pathname.startsWith('/tracking/')) content = <OrderExperience trackingOnly />
  else if (/^\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(pathname)) content = <LandingPageExperience slug={pathname.replace(/^\//, '').replace(/\/$/, '')} />
  else content = <section className="section"><div className="container"><EmptyState title={t('delight.notFound')} description={t('delight.notFoundHelp')} action={<Button onClick={() => window.location.assign('/shop')}>{t('delight.explore')}</Button>} /></div></section>

  return <div className="storefront"><SiteHeader cartCount={cartCount} wishlistCount={wishlistCount} /><a className="skip-link" href="#storefront-content">{t('delight.skip')}</a><main id="storefront-content">{content}</main><SiteFooter /></div>
}


