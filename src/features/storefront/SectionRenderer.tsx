import { fetchWithSession } from '../../lib/session'
import { useEffect, useState, type CSSProperties } from 'react'
import { safeHref, safeWebUrl } from '../../lib/safe-url'
import { storefrontImageLoading } from '../../lib/images'
import { ProductGrid, type Product, type ProductVariant } from '../../components/commerce'
import { mapProduct, type RawProduct } from '../catalog/ProductCatalog'
import { addToBag } from '../../lib/shopping'
import { getAccessToken } from '../../lib/session'
import { Toast } from '../../components/ui'
import { Reveal, StoreTrust } from '../../components/Experience'
import './sections.css'
import { useI18n } from '../../i18n/I18nProvider'

export type StoreSection = { _id: string; type: string; title?: string; content: Record<string, any>; translations?: { en?: { title?: string; content?: Record<string, any> }; bn?: { title?: string; content?: Record<string, any> } }; products?: Array<{ _id: string; name: string; translations?: { en?: { name?: string }; bn?: { name?: string } }; slug: string; price: number; discountPercent?: number; variants?: RawProduct['variants']; media?: Array<{ url?: string; src?: string; alt?: string }> }>; categories?: Array<{ _id: string; name: string; translations?: { en?: { name?: string }; bn?: { name?: string } }; slug: string; imageUrl?: string }> }

function ProductTiles({ section, wished, onWishlist, onAdd }: { section: StoreSection; wished: string[]; onWishlist: (product: Product) => void; onAdd: (product: Product, variant?: ProductVariant, buyNow?: boolean) => void }) {
  const { locale } = useI18n()
  const products = (section.products || []).map((product) => mapProduct({ ...product, variants: product.variants || [], media: product.media || [] } as RawProduct, locale))
  return <ProductGrid products={products} wished={wished} onWishlist={onWishlist} onAdd={onAdd} onBuyNow={(product, variant) => onAdd(product, variant, true)} />
}
function Actions({ content, hero = false }: { content: Record<string, any>; hero?: boolean }) {
  const { t } = useI18n()
  const primaryUrl = safeHref(content.buttonUrl); const secondaryUrl = safeHref(content.secondaryButtonUrl)
  return <div className="builder-actions">{content.buttonLabel && primaryUrl && <a className="builder-button" href={primaryUrl}>{content.buttonLabel}</a>}{hero && !content.secondaryButtonLabel && <a className="builder-button builder-button--quiet" href="/shop?sort=newest">{t('common.newArrivals')} ↗</a>}{content.secondaryButtonLabel && secondaryUrl && <a className="builder-button builder-button--quiet" href={secondaryUrl}>{content.secondaryButtonLabel}</a>}</div>
}
function Copy({ section, centered = false, hero = false }: { section: StoreSection; centered?: boolean; hero?: boolean }) {
  const content = section.content
  const Heading = hero ? 'h1' : 'h2'
  return <div className={`builder-copy ${centered ? 'builder-copy--center' : ''}`}><p className="eyebrow">{content.eyebrow}</p><Heading>{content.headline || content.title || section.title}</Heading>{content.body && <p>{content.body}</p>}<Actions content={content} hero={hero} /></div>
}
export function SectionRenderer({ sections }: { sections: StoreSection[] }) {
  const { locale, t } = useI18n()
  const [wished, setWished] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
  useEffect(() => {
    let alive = true
    void getAccessToken().then(async (token) => {
      if (!token) return
      const headers = new Headers({ Authorization: `Bearer ${token}` })
      if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
      const response = await fetchWithSession(`${apiBase}/users/me/wishlist`, { headers, credentials: 'include' })
      const result = await response.json()
      if (alive && response.ok) setWished((result.data?.products || []).map((product: { _id: string }) => product._id))
    }).catch(() => undefined)
    return () => { alive = false }
  }, [apiBase])
  const add = async (product: Product, variant?: ProductVariant, buyNow = false) => {
    if (!variant?.available) return
    if (buyNow) { window.location.assign(`/checkout?buyNow=${encodeURIComponent(variant.id)}`); return }
    setError('')
    try { await addToBag(product, variant); setNotice(t('product.added')) }
    catch { setError(t('product.unavailable')) }
  }
  const wishlist = async (product: Product) => {
    setError('')
    const token = await getAccessToken()
    if (!token) { setError(t('product.signInToSave')); return }
    const active = wished.includes(product.id)
    const headers = new Headers({ Authorization: `Bearer ${token}` })
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    try {
      const response = await fetchWithSession(`${apiBase}/users/me/wishlist/${product.id}`, { method: active ? 'DELETE' : 'POST', headers, credentials: 'include' })
      if (!response.ok) throw new Error()
      const next = active ? wished.filter((id) => id !== product.id) : [...wished, product.id]
      setWished(next)
      window.dispatchEvent(new CustomEvent('storefront-wishlist-count', { detail: { count: next.length } }))
      setNotice(t(active ? 'product.removedFromWishlist' : 'product.savedToWishlist'))
    } catch { setError(t('product.unavailable')) }
  }
  const localizedSections = sections.map((section) => {
    const translation = section.translations?.[locale] ?? section.translations?.en
    return { ...section, title: translation?.title || section.title, content: { ...section.content, ...(translation?.content || {}) }, products: section.products?.map((product) => ({ ...product, name: product.translations?.[locale]?.name || product.translations?.en?.name || product.name })), categories: section.categories?.map((category) => ({ ...category, name: category.translations?.[locale]?.name || category.translations?.en?.name || category.name })) }
  })
  return <div className="builder-sections">{error && <p className="catalog-feedback catalog-feedback--error" role="alert">{error} <a href="/account/sign-in">{t('account.signIn')}</a></p>}<Toast message={notice} open={Boolean(notice)} onClose={() => setNotice('')} />{localizedSections.map((section) => {
    const c = section.content || {}
    const style = { ...(c.backgroundColor ? { '--section-bg': c.backgroundColor } : {}), ...(c.textColor ? { '--section-text': c.textColor } : {}) } as CSSProperties
    const type = ({ editorial: 'image_text', promotion_banner: 'banner', product_collection: 'product_grid', rich_text: 'custom_content' } as Record<string, string>)[section.type] || section.type
    if (type === 'hero' || type === 'banner' || type === 'lookbook') return <div key={section._id}><section className={`builder-section builder-feature builder-feature--${type}`} style={style}>{safeWebUrl(c.imageUrl) && <img src={safeWebUrl(c.imageUrl)} alt={c.imageAlt || ''} loading={type === 'hero' ? 'eager' : 'lazy'} decoding="async" />}<div className="builder-feature__overlay"><Copy section={section} hero={type === 'hero'} /></div></section>{type === 'hero' && <StoreTrust />}</div>
    if (type === 'product_grid' || type === 'product_carousel') return <section className={`builder-section builder-content ${type === 'product_carousel' ? 'builder-carousel' : ''}`} style={style} key={section._id}><Reveal><div className="builder-section__head"><Copy section={section} /></div></Reveal><ProductTiles section={section} wished={wished} onWishlist={(product) => void wishlist(product)} onAdd={(product, variant, buyNow) => void add(product, variant, buyNow)} /></section>
    if (type === 'categories' || type === 'collections') return <section className="builder-section builder-content" style={style} key={section._id}><div className="builder-section__head"><Copy section={section} /></div><div className="builder-categories">{section.categories?.map((category) => <a href={`/category/${category.slug}`} key={category._id}>{category.imageUrl && <img loading={storefrontImageLoading()} src={category.imageUrl} alt="" />}<span>{category.name}</span></a>)}</div></section>
    if (type === 'image_text') return <section className="builder-section builder-image-text" style={style} key={section._id}>{safeWebUrl(c.imageUrl) && <img loading={storefrontImageLoading()} decoding="async" src={safeWebUrl(c.imageUrl)} alt={c.imageAlt || ''} />}<Copy section={section} /></section>
    if (type === 'video') return <section className="builder-section builder-content builder-video" style={style} key={section._id}>{c.title && <h2>{c.title}</h2>}{safeWebUrl(c.videoUrl) && <video controls preload="metadata" poster={safeWebUrl(c.imageUrl)}><source src={safeWebUrl(c.videoUrl)} /></video>}</section>
    if (type === 'testimonials' || type === 'reviews') return <section className="builder-section builder-content" style={style} key={section._id}><Copy section={section} centered /><div className="builder-quotes">{(c.items || []).map((item: any, i: number) => <blockquote key={`${section._id}-${i}`}><p>{item.body}</p><cite>{item.title}</cite></blockquote>)}</div></section>
    if (type === 'instagram') return <section className="builder-section builder-content" style={style} key={section._id}><Copy section={section} centered /><div className="builder-categories">{(c.items || []).map((item: any, i: number) => <a href={safeHref(item.url) || '#'} key={`${section._id}-${i}`}>{safeWebUrl(item.imageUrl) && <img loading={storefrontImageLoading()} decoding="async" src={safeWebUrl(item.imageUrl)} alt={item.imageAlt || ''} />}{item.title}</a>)}</div></section>
    if (type === 'newsletter') return <section className="builder-section builder-newsletter" style={style} key={section._id}><Copy section={section} centered /><p className="builder-newsletter-help">{t('delight.newsletterHelp')}</p><a className="builder-button" href="/contact">{locale === 'bn' ? 'আমাদের সাথে যোগাযোগ করুন' : 'Contact our team'}</a></section>
    if (type === 'cta') return <section className="builder-section builder-cta" style={style} key={section._id}><Copy section={section} centered /></section>
    if (type === 'custom_content') return <section className="builder-section builder-content builder-rich-text" style={style} key={section._id}>{c.title && <h2>{c.title}</h2>}<p>{c.body}</p></section>
    return null
  })}</div>
}
