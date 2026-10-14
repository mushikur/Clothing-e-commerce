import { fetchWithSession } from '../../lib/session'
import { lazy,Suspense,useEffect, useState } from 'react'
import { AddToCartButton, ColorSelector, Price, ProductGallery, SizeSelector, type Product } from '../../components/commerce'
import { Button, Skeleton } from '../../components/ui'
import { useBusinessConfig } from '../storefront/StorefrontConfig'
import { getAccessToken } from '../../lib/session'
import { addToBag } from '../../lib/shopping'
import './product-detail.css'
import ProductReviews from './ProductReviews'
import { mapProduct, type RawProduct } from './ProductCatalog'
import { absoluteStorefrontUrl, setPageMetadata } from '../../lib/seo'
import { SiteHeader, SiteFooter } from '../storefront/CustomerSite'
import { SizeGuide } from '../../components/Experience'
import { guestCartCount } from '../../lib/guest-cart'
import { useI18n } from '../../i18n/I18nProvider'

const RelatedProducts=lazy(()=>import('./RelatedProducts'))
const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type ApiResult<T> = { success: boolean; data?: T; error?: { message?: string } }

export default function ProductDetailExperience() {
  const { locale, t } = useI18n()
  const { config: businessConfig } = useBusinessConfig()
  const slug = window.location.pathname.split('/').filter(Boolean).at(-1) || ''
  const [product, setProduct] = useState<Product | null>(null)
  const [rawProduct, setRawProduct] = useState<RawProduct | null>(null)
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [cartCount, setCartCount] = useState(() => guestCartCount())
  const [color, setColor] = useState('')
  const [size, setSize] = useState('')
  const [token, setToken] = useState('')
  const [saved, setSaved] = useState(false)
  const [wishlistCount, setWishlistCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(()=>{
    const cartChanged=(event:Event)=>setCartCount((event as CustomEvent<{count:number}>).detail?.count??guestCartCount())
    const wishlistChanged=(event:Event)=>setWishlistCount((event as CustomEvent<{count:number}>).detail.count)
    window.addEventListener('storefront-cart-count',cartChanged);window.addEventListener('storefront-wishlist-count',wishlistChanged)
    return()=>{window.removeEventListener('storefront-cart-count',cartChanged);window.removeEventListener('storefront-wishlist-count',wishlistChanged)}
  },[])

  useEffect(() => {
    let alive = true
    void getAccessToken().then(async (access) => {
      if (!access) return
      const headers = new Headers({ Authorization: `Bearer ${access}` })
      if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
      const [cartResponse, wishResponse] = await Promise.all([fetchWithSession(`${apiBase}/cart`, { headers, credentials: 'include' }), fetchWithSession(`${apiBase}/users/me/wishlist`, { headers, credentials: 'include' })])
      if (!alive) return
      if (cartResponse.ok) { const cart = await cartResponse.json(); setCartCount(cart.data?.items?.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0) || 0) }
      if (wishResponse.ok) { const wish = await wishResponse.json(); const products = wish.data?.products || []; setWishlistCount(products.length); setSaved(products.some((item: { slug: string }) => item.slug === slug)) }
    }).catch(() => undefined)
    return () => { alive = false }
  }, [slug])

  useEffect(() => {
    let alive = true
    const headers = new Headers()
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    fetchWithSession(`${apiBase}/products/${encodeURIComponent(slug)}`, { headers, credentials: 'include' }).then(async (response) => {
      const result = await response.json() as ApiResult<RawProduct>
      if (!response.ok || !result.success || !result.data) throw new Error(result.error?.message || t('product.notFound'))
      if (alive) { setRawProduct(result.data); setProduct(mapProduct(result.data, locale)); setColor((current) => result.data!.variants.some((variant) => variant.color === current) ? current : result.data!.variants[0]?.color ?? '') }
    }).catch((cause: unknown) => { if (alive) setError(cause instanceof Error ? cause.message : t('product.notFound')) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [slug, locale])

  useEffect(() => {
    if (!rawProduct || !product) return
    const canonical = absoluteStorefrontUrl(`/products/${rawProduct.slug}`)
    const productImages = [...new Set([...(rawProduct.media || []).filter((media) => media.kind === 'image').map((media) => media.url), ...(rawProduct.variants || []).flatMap((variant) => variant.images?.map((image) => image.url) || [])])].map((image) => absoluteStorefrontUrl(image))
    const offers = rawProduct.variants.map((variant) => ({ '@type': 'Offer', sku: variant.sku, priceCurrency: variant.currency, price: (Math.round(variant.price * (100 - (rawProduct.discountPercent || 0)) / 100) / 100).toFixed(2), availability: variant.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: canonical, itemCondition: 'https://schema.org/NewCondition', additionalProperty: [{ '@type': 'PropertyValue', name: 'Color', value: variant.color }, { '@type': 'PropertyValue', name: 'Size', value: variant.size }] }))
    const localized = rawProduct.translations?.[locale] ?? rawProduct.translations?.en
    const productName = localized?.name || rawProduct.name
    const productDescription = localized?.shortDescription || localized?.description || rawProduct.shortDescription || rawProduct.description || ''
    const category = typeof rawProduct.categoryId === 'object' ? rawProduct.categoryId.translations?.[locale]?.name || rawProduct.categoryId.name : product.category
    const canonicalUrl = rawProduct.seo?.canonicalUrl || canonical
    const categoryUrl = rawProduct.categoryId?.slug ? absoluteStorefrontUrl(`/category/${rawProduct.categoryId.slug}`) : absoluteStorefrontUrl('/shop')
    const structuredData = { '@context': 'https://schema.org', '@type': 'Product', name: productName, description: productDescription || `${productName} from ${businessConfig.name}.`, sku: rawProduct.sku, inLanguage: locale === 'bn' ? 'bn-BD' : 'en-BD', ...(rawProduct.brand ? { brand: { '@type': 'Brand', name: rawProduct.brand } } : {}), ...(productImages.length ? { image: productImages } : {}), category, offers, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: businessConfig.name, item: absoluteStorefrontUrl('/') }, { '@type': 'ListItem', position: 2, name: category, item: categoryUrl }, { '@type': 'ListItem', position: 3, name: productName, item: canonicalUrl }] } }
    setPageMetadata({ title: localized?.seoTitle || rawProduct.seo?.title || `${productName} | ${businessConfig.name}`, description: localized?.seoDescription || rawProduct.seo?.description || productDescription || `${productName} from ${businessConfig.name}.`, canonical: canonicalUrl, image: productImages[0], type: 'product', structuredData })
  }, [product, rawProduct, locale])

  const availableVariants = product?.variants ?? []
  const colorVariants = availableVariants.filter((variant) => variant.color === color)
  const sizes = [...new Set(colorVariants.map((variant) => variant.size))]
  const selected = colorVariants.find((variant) => variant.size === size)
  const colorImages = product?.colors?.find((item) => item.name === color)?.images
  const images = colorImages?.length ? colorImages : product?.images?.length ? product.images : product ? [{ src: product.image, alt: product.alt }] : []
  const shownPrice = selected ? Math.round(selected.price * (100 - (rawProduct?.discountPercent ?? 0)) / 100) / 100 : product?.price ?? 0
  const compareAt = selected?.compareAtPrice ? selected.compareAtPrice / 100 : selected && rawProduct?.discountPercent ? selected.price / 100 : product?.compareAt

  const authorized = async (path: string, method: 'POST' | 'DELETE', body?: unknown) => {
    let access = token
    if (!access) {
      access = await getAccessToken() || ''
      if (!access) throw new Error(t('product.signInToSave'))
      setToken(access)
    }
    const headers = new Headers({ Authorization: `Bearer ${access}` })
    if (body) headers.set('Content-Type', 'application/json')
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    const response = await fetchWithSession(`${apiBase}${path}`, { method, headers, credentials: 'include', ...(body ? { body: JSON.stringify(body) } : {}) })
    const result = await response.json() as ApiResult<unknown>
    if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to complete this request.')
  }

  const add = async (buyNow = false) => {
    if (!product || !selected) { setError(t('product.chooseVariant')); return }
    if (buyNow) { setBusy(true); window.location.assign(`/checkout?buyNow=${encodeURIComponent(selected.id)}&quantity=${quantity}`); return }
    setBusy(true); setAdding(true); setError(''); setNotice('')
    try {
      setCartCount(await addToBag(product, selected, quantity))
      setNotice(t('product.added'))
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('product.unavailable')) }
    finally { setAdding(false); setBusy(false) }
  }
  const wishlist = async () => {
    if (!product) return
    setBusy(true); setError(''); setNotice('')
    try { await authorized(`/users/me/wishlist/${product.id}`, saved ? 'DELETE' : 'POST'); setSaved(!saved); setWishlistCount((count) => Math.max(0, count + (saved ? -1 : 1))); setNotice(saved ? t('product.removed') : t('product.saved')) }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('product.signInToSave')) }
    finally { setBusy(false) }
  }

  if (loading) return <main className="product-detail-page"><header className="account-top"><a href="/" className="account-wordmark">{businessConfig.name}</a><a className="account-top__link" href="/">{t('product.returnCollection')} ↗</a></header><section className="product-detail product-detail--loading" aria-busy="true"><span className="sr-only" role="status">{t('catalog.finding')}</span><Skeleton className="product-detail-skeleton__image" /><div className="product-detail-skeleton"><Skeleton className="product-detail-skeleton__line product-detail-skeleton__line--short" /><Skeleton className="product-detail-skeleton__line product-detail-skeleton__line--title" /><Skeleton className="product-detail-skeleton__line" /><Skeleton className="product-detail-skeleton__line product-detail-skeleton__line--price" /><Skeleton className="product-detail-skeleton__block" /><Skeleton className="product-detail-skeleton__block" /><Skeleton className="product-detail-skeleton__button" /></div></section></main>
  if (!product || !rawProduct) return <main className="product-detail-page"><header className="account-top"><a href="/" className="account-wordmark">{businessConfig.name}</a></header><div className="admin-blocked"><p className="account-kicker">{t('catalog.collection')}</p><h1>{t('product.notFound')}</h1><p role="alert">{error || t('product.notFoundHelp')}</p><Button onClick={() => window.location.assign('/')}>{t('product.returnCollection')}</Button></div></main>

  return <div className="storefront product-storefront"><SiteHeader cartCount={cartCount} wishlistCount={wishlistCount} /><main className="product-detail-page"><nav className="product-breadcrumb" aria-label={t('product.returnCollection')}><a href="/">{t('common.home')}</a><span>/</span><a href="/#new">{product.category}</a><span>/</span><span aria-current="page">{product.name}</span></nav><section className="product-detail"><div className="product-detail__gallery"><ProductGallery key={`${product.id}-${color}`} images={images} name={product.name} /></div><div className="product-detail__info"><p className="account-kicker">{product.category}</p><h1>{product.name}</h1>{product.description && <p className="product-detail__description">{product.description}</p>}<Price amount={shownPrice} compareAt={compareAt} currency={selected?.currency || businessConfig.currency} /><div className="product-detail__rule" /><div className="product-detail__selector"><div><span className="eyebrow">{t('product.color')}</span><strong>{color}</strong></div><ColorSelector colors={product.colors} value={color} onChange={(next) => { setColor(next); setSize(''); setQuantity(1) }} /></div><div className="product-detail__selector"><div><span className="eyebrow">{t('product.size')}</span><strong>{size || t('delight.chooseSize')}</strong></div><SizeSelector sizes={sizes} value={size} disabledSizes={sizes.filter((option) => !colorVariants.some((variant) => variant.size === option && variant.available))} onChange={(value) => { setSize(value); setQuantity(1) }} /></div>{selected && <p className={selected.available ? 'product-detail__stock' : 'product-detail__stock product-detail__stock--out'}>{selected.available ? t('product.stockCount', { count: selected.stock }) : t('product.outOfStock')}</p>}<button className="size-guide-trigger" onClick={() => setSizeGuideOpen(true)}>{t('product.sizeGuide')} ↗</button><SizeGuide open={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} category={`${rawProduct.categoryId?.slug || ''} ${rawProduct.slug} ${rawProduct.name}`} gender={rawProduct.gender} />{selected?.available && <div className="product-quantity"><span>{t('delight.quantity')}</span><div><button aria-label={t('delight.decrease')} disabled={quantity <= 1 || busy} onClick={() => setQuantity((value) => value - 1)}>−</button><output aria-live="polite">{quantity}</output><button aria-label={t('delight.increase')} disabled={quantity >= Math.min(selected.stock, 99) || busy} onClick={() => setQuantity((value) => value + 1)}>+</button></div></div>}{error && <p className="catalog-feedback catalog-feedback--error" role="alert">{error}{error.toLowerCase().startsWith('sign in') && <> <a href="/account/sign-in">{t('account.signIn')}</a></>}</p>}{notice && <p className="catalog-feedback" role="status">{notice}</p>}<div className="product-detail__actions"><AddToCartButton disabled={!selected?.available || busy} loading={adding} onClick={() => void add()} /><Button variant="secondary" disabled={!selected?.available || busy} onClick={() => void add(true)}>{t('product.buyNow')} <span aria-hidden="true">↗</span></Button><button className={`product-detail__wish ${saved ? 'is-saved' : ''}`} disabled={busy} aria-pressed={saved} onClick={() => void wishlist()}>{saved ? t('product.saved') : t('common.wishlist')} <span aria-hidden="true">{saved ? '♥' : '♡'}</span></button></div><div className="product-detail__accordions"><details><summary>{t('product.details')}</summary><p>{product.material ? `${t('product.material')}: ${product.material}. ` : ''}{product.fabric ? `${t('product.fabric')}: ${product.fabric}. ` : ''}{product.description}</p></details><details><summary>{t('product.deliveryReturns')}</summary><p>{t('delight.delivery')}</p><a className="link-arrow" href="/returns">{t('delight.returns')}</a></details></div><p className="product-detail__sku">SKU {selected?.sku || rawProduct.sku}</p></div></section><ProductReviews slug={rawProduct.slug} /><Suspense fallback={null}><RelatedProducts categoryId={rawProduct.categoryId?._id} excludeId={rawProduct._id}/></Suspense></main><SiteFooter /></div>
}

