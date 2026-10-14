import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { businessConfig as fallback } from '../../config/business'
import { absoluteStorefrontUrl, setPageMetadata } from '../../lib/seo'
import { useI18n } from '../../i18n/I18nProvider'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type PublicConfig = {
  business: { name: string; currency: string; locale: string }
  settings: { displayName: string; logoUrl?: string; faviconUrl?: string; defaultLanguage?: 'en' | 'bn'; enabledLocales?: Array<'en' | 'bn'>; contact?: { email?: string; phone?: string; address?: string }; socialLinks?: Array<{ platform: string; url: string }>; seo?: { title?: string; description?: string; defaultImageUrl?: string } }
  media?: { lazyLoading: boolean }
  theme?: { preset: string; colors: Record<string, string>; typography: { displayFont: string; bodyFont: string }; components: Record<string, string> } | null
}
type BusinessContextValue = { config: typeof fallback; settings: PublicConfig['settings']; theme: PublicConfig['theme']; loaded: boolean }
const BusinessContext = createContext<BusinessContextValue>({ config: fallback, settings: { displayName: fallback.name }, theme: null, loaded: false })

function applyTheme(theme: PublicConfig['theme'] | null | undefined) {
  const root = document.documentElement
  if (!theme) { root.removeAttribute('data-store-theme'); return }
  root.dataset.storeTheme = theme.preset
  root.dataset.theme = theme.preset === 'dark_fashion' ? 'dark' : 'light'
  root.style.setProperty('--color-primary-contrast', theme.colors.background)
  root.style.setProperty('--color-surface-muted', `color-mix(in srgb, ${theme.colors.background} 86%, ${theme.colors.secondary})`)
  const colorTokens: Record<string, string> = { primary: 'primary', secondary: 'secondary', accent: 'accent', background: 'background', surface: 'surface', text: 'text', mutedText: 'text-muted', border: 'border', success: 'success', warning: 'warning', error: 'error' }
  Object.entries(colorTokens).forEach(([key, token]) => { const value = theme.colors[key]; if (value) root.style.setProperty(`--color-${token}`, value) })
  const fonts = { serif: '"Iowan Old Style", "Baskerville", "Palatino Linotype", Georgia, serif', editorial: '"Iowan Old Style", "Baskerville", "Palatino Linotype", Georgia, serif', sans: '"Avenir Next", Avenir, "Segoe UI", sans-serif' }
  root.style.setProperty('--font-display', fonts[theme.typography.displayFont as keyof typeof fonts] || fonts.editorial)
  root.style.setProperty('--font-body', fonts[theme.typography.bodyFont as keyof typeof fonts] || fonts.sans)
  const radius = { sharp: ['0.1rem', '0.2rem', '0.35rem'], soft: ['0.25rem', '0.5rem', '0.9rem'], rounded: ['0.5rem', '0.9rem', '1.35rem'] }[theme.components.radius]
  if (radius) ['--radius-sm', '--radius-md', '--radius-lg'].forEach((key, index) => root.style.setProperty(key, radius[index]))
  const spacing = { compact: '0.82', comfortable: '1', relaxed: '1.14' }[theme.components.spacing]
  if (spacing) root.style.setProperty('--theme-spacing-scale', spacing)
  root.dataset.buttonStyle = theme.components.buttonStyle
  root.dataset.cardStyle = theme.components.cardStyle
  root.dataset.headerStyle = theme.components.headerStyle
  root.dataset.footerStyle = theme.components.footerStyle
  root.dataset.backgroundStyle = theme.components.backgroundStyle
}

export function StorefrontConfigProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const { setDefaultLocale } = useI18n()
  const [value, setValue] = useState<BusinessContextValue>({ config: fallback, settings: { displayName: fallback.name }, theme: null, loaded: false })
  useEffect(() => {
    if (!enabled) return
    let active = true
    const headers = new Headers()
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    fetch(`${apiBase}/storefront/config`, { headers, credentials: 'include' }).then(async (response) => {
      const result = await response.json() as { success?: boolean; data?: PublicConfig }
      if (!response.ok || !result.success || !result.data) return
      if (!active) return
      const data = result.data
      if (data.settings.defaultLanguage) setDefaultLocale(data.settings.defaultLanguage)
      applyTheme(data.theme)
      document.documentElement.dataset.storefrontLazyImages = String(data.media?.lazyLoading ?? true)
      if (data.settings.faviconUrl) {
        let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
        if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.append(icon) }
        icon.href = data.settings.faviconUrl
      }
      setValue({ config: { ...fallback, name: data.business.name, currency: data.business.currency, supportEmail: data.settings.contact?.email || '', instagramUrl: data.settings.socialLinks?.find((link) => link.platform.toLowerCase() === 'instagram')?.url || '' }, settings: data.settings, theme: data.theme, loaded: true })
    }).catch(() => undefined)
    return () => { active = false }
  }, [enabled, setDefaultLocale])
  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
}

export function useBusinessConfig() { return useContext(BusinessContext) }

const pageNames: Record<string, string> = { shop: 'Shop', about: 'About', contact: 'Contact', faq: 'Frequently asked questions', privacy: 'Privacy policy', terms: 'Terms and conditions', returns: 'Returns and exchanges', refunds: 'Refund policy', shipping: 'Shipping information', policies: 'Store policies' }
function readableSlug(value: string) { return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') }

export function StorefrontMetadata({ pathname }: { pathname: string }) {
  const { config, settings, loaded } = useBusinessConfig()
  useEffect(() => {
    if (pathname.startsWith('/admin') || /^\/products\//.test(pathname)) return
    const parts = pathname.split('/').filter(Boolean)
    const isPrivate = ['/account', '/cart', '/checkout', '/wishlist', '/orders', '/tracking', '/admin'].some((path) => pathname === path || pathname.startsWith(`${path}/`))
    const isSearch = pathname === '/search'
    const titlePart = parts[0] === 'category' || parts[0] === 'subcategory' ? readableSlug(parts[1] || 'Shop') : pageNames[parts[0] || ''] || (parts.length ? readableSlug(parts.at(-1)!) : config.name)
    const title = pathname === '/' ? settings.seo?.title || config.name : `${titlePart} | ${config.name}`
    const description = pathname === '/' ? settings.seo?.description || `Discover the latest collection from ${config.name}.` : `Explore ${titlePart.toLowerCase()} from ${config.name}.`
    const canonicalPath = pathname === '/search' ? '/search' : pathname
    const canonical = absoluteStorefrontUrl(canonicalPath)
    const breadcrumbItems = [{ '@type': 'ListItem', position: 1, name: 'Home', item: absoluteStorefrontUrl('/') }, ...parts.map((part, index) => ({ '@type': 'ListItem', position: index + 2, name: pageNames[part] || readableSlug(part), item: absoluteStorefrontUrl(`/${parts.slice(0, index + 1).join('/')}`) }))]
    const structuredData = pathname === '/' ? { '@context': 'https://schema.org', '@type': 'WebSite', name: config.name, url: absoluteStorefrontUrl('/') } : { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumbItems }
    setPageMetadata({ title, description, canonical, image: settings.seo?.defaultImageUrl, robots: isPrivate || isSearch ? 'noindex,nofollow' : 'index,follow', structuredData })
  }, [config.name, loaded, pathname, settings.seo?.defaultImageUrl, settings.seo?.description, settings.seo?.title])
  return null
}

