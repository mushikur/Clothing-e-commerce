import { fetchWithSession } from '../../lib/session'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ProductGrid, type Product, type ProductVariant } from '../../components/commerce'
import { businessConfig } from '../../config/business'
import { getAccessToken } from '../../lib/session'
import { addToBag } from '../../lib/shopping'
import { Button, Drawer, EmptyState, Select, Skeleton } from '../../components/ui'
import './catalog.css'
import { useI18n } from '../../i18n/I18nProvider'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type ApiResult<T> = { success: boolean; data?: T; error?: { message?: string }; meta?: { page: number; pages: number; total: number } }
type Category = { _id: string; name: string; slug: string; translations?: { en?: { name?: string }; bn?: { name?: string } }; subcategories: Category[] }
export type RawResponsiveImage = { label: string; width: number; height: number; format: string; url: string }
export type RawProductImage = { url: string; alt?: string; sortOrder?: number; width?: number; height?: number; responsiveVariants?: RawResponsiveImage[] }
export type RawProduct = { _id: string; name: string; slug: string; sku: string; brand?: string; gender?: string; season?: string; description?: string; shortDescription?: string; translations?: { en?: { name?: string; description?: string; shortDescription?: string; seoTitle?: string; seoDescription?: string }; bn?: { name?: string; description?: string; shortDescription?: string; seoTitle?: string; seoDescription?: string } }; material?: string; fabric?: string; price: number; discountPercent?: number; seo?: { title?: string; description?: string; canonicalUrl?: string }; media: ({ kind: string; url: string; alt?: string; width?: number; height?: number; responsiveVariants?: RawResponsiveImage[] })[]; categoryId?: { _id?:string; name: string; slug?: string; translations?: { en?: { name?: string }; bn?: { name?: string } } }; variants: Array<{ _id: string; sku: string; color: string; colorCode?: string; size: string; price: number; compareAtPrice?: number; currency: string; stock: number; available: boolean; images?: RawProductImage[] }> }

async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers()
  if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
  if (init.method && init.method !== 'GET') headers.set('Content-Type', 'application/json')
  const response = await fetchWithSession(`${apiBase}${path}`, { ...init, headers, credentials: 'include' })
  const body = await response.json() as ApiResult<T>
  if (!response.ok || !body.success) throw new Error(body.error?.message || 'Unable to load the collection.')
  return body
}

export default function ProductCatalog({ onCartCountChange, onWishlistCountChange, initialSort, limit = 12, showFilters = true, discountedOnly = false }: { onCartCountChange?: (count: number) => void; onWishlistCountChange?: (count: number) => void; initialSort?: string; limit?: number; showFilters?: boolean; discountedOnly?: boolean }) {
  const { locale, t } = useI18n()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [items, setItems] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('q') || '')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [sort, setSort] = useState(() => initialSort || new URLSearchParams(window.location.search).get('sort') || 'newest')
  const [brand, setBrand] = useState('')
  const [gender, setGender] = useState('')
  const [season, setSeason] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [wishlisted, setWishlisted] = useState<string[]>([])
  const [accessToken, setAccessToken] = useState('')

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), sort })
    if (search.trim()) params.set('q', search.trim())
    if (categoryId) params.set('categoryId', categoryId)
    if (subcategoryId) params.set('subcategoryId', subcategoryId)
    if (size) params.set('size', size)
    if (color) params.set('color', color)
    if (brand) params.set('brand', brand)
    if (gender) params.set('gender', gender)
    if (season) params.set('season', season)
    if (minPrice && Number.isFinite(Number(minPrice))) params.set('minPrice', String(Math.round(Number(minPrice) * 100)))
    if (maxPrice && Number.isFinite(Number(maxPrice))) params.set('maxPrice', String(Math.round(Number(maxPrice) * 100)))
    if (discountedOnly) params.set('discounted', 'true')
    return params.toString()
  }, [page, search, categoryId, subcategoryId, size, color, sort, brand, gender, season, minPrice, maxPrice, limit, discountedOnly])
  const requestPath = sort === 'best_selling' ? `/products/best-sellers?limit=${limit}` : sort === 'trending' ? `/products/trending?limit=${limit}` : `/products?${query}`

  const ensureToken = useCallback(async () => {
    if (accessToken) return accessToken
    const token = await getAccessToken()
    if (!token) throw new Error(t('product.signInToSave'))
    setAccessToken(token)
    return token
  }, [accessToken])

  const authorizedRequest = useCallback(async <T,>(path: string, init: RequestInit = {}) => {
    const token = await ensureToken()
    const headers = new Headers(init.headers)
    headers.set('Content-Type', 'application/json')
    headers.set('Authorization', `Bearer ${token}`)
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    const response = await fetchWithSession(`${apiBase}${path}`, { ...init, headers, credentials: 'include' })
    const body = await response.json() as ApiResult<T>
    if (!response.ok || !body.success) throw new Error(body.error?.message || 'Sign in to use this account feature.')
    return body.data as T
  }, [ensureToken])

  useEffect(() => {
    let alive = true
    publicRequest<{ categories: Category[] }>('/categories').then((result) => {
      if (!alive) return
      const rows = result.data?.categories ?? []
      setCategories(rows)
      const pieces = window.location.pathname.split('/').filter(Boolean)
      const routeSlug = pieces.at(-1)
      if (pieces[0] === 'category' && routeSlug) setCategoryId(rows.find((item) => item.slug === routeSlug)?._id ?? '')
      if (pieces[0] === 'subcategory' && routeSlug) {
        const parent = rows.find((item) => item.subcategories.some((sub) => sub.slug === routeSlug))
        const child = parent?.subcategories.find((sub) => sub.slug === routeSlug)
        if (parent && child) { setCategoryId(parent._id); setSubcategoryId(child._id) }
      }
    }).catch(() => undefined)
    return () => { alive = false }
  }, [locale])
  useEffect(() => {
    let alive = true
    const timer = window.setTimeout(() => {
      setLoading(true); setError(''); setLoadError('')
      publicRequest<RawProduct[]>(requestPath).then((result) => {
        if (!alive) return
        const data = (result.data ?? []).map((item) => mapProduct(item, locale))
        setItems(data); setPages(result.meta?.pages ?? 1); setTotal(result.meta?.total ?? data.length)
      }).catch((cause: unknown) => {
        if (!alive) return
        const message = cause instanceof TypeError ? 'We could not reach the collection. Check your connection and try again.' : cause instanceof Error ? cause.message : 'Unable to load the collection.'
        setLoadError(message)
      }).finally(() => { if (alive) setLoading(false) })
    }, search ? 220 : 0)
    return () => { alive = false; window.clearTimeout(timer) }
  }, [requestPath, retryCount, search, locale])
  useEffect(() => { setPage(1) }, [search, categoryId, subcategoryId, size, color, sort, brand, gender, season, minPrice, maxPrice])
  useEffect(() => {
    let alive = true
    getAccessToken().then(async (token) => {
      if (!token) return
      const headers = new Headers({ Authorization: `Bearer ${token}` })
      if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
      const [cartResponse, wishlistResponse] = await Promise.all([fetchWithSession(`${apiBase}/cart`, { headers, credentials: 'include' }), fetchWithSession(`${apiBase}/users/me/wishlist`, { headers, credentials: 'include' })])
      if (!cartResponse.ok || !wishlistResponse.ok) return
      const cart = await cartResponse.json() as ApiResult<{ items: Array<{ quantity: number }> }>
      const wishlist = await wishlistResponse.json() as ApiResult<{ products: Array<{ _id: string }> }>
      if (!alive) return
      setAccessToken(token)
      onCartCountChange?.(cart.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0)
      setWishlisted(wishlist.data?.products.map((product) => product._id) ?? [])
      onWishlistCountChange?.(wishlist.data?.products.length ?? 0)
    }).catch(() => undefined)
    return () => { alive = false }
  }, [onCartCountChange, onWishlistCountChange])

  const add = async (product: Product, variant?: ProductVariant, buyNow = false) => {
    if (!variant) { setNotice(t('product.chooseVariant')); return }
    if (buyNow) { window.location.assign(`/checkout?buyNow=${encodeURIComponent(variant.id)}`); return }
    setError(''); setNotice('')
    try {
      onCartCountChange?.(await addToBag(product, variant))
      setNotice(t('product.addedVariant', { name: product.name, color: variant.color, size: variant.size }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('product.unavailable')); setNotice('') }
  }

  const toggleWishlist = async (product: Product) => {
    setError(''); setNotice('')
    try {
      const currentlySaved = wishlisted.includes(product.id)
      await authorizedRequest(currentlySaved ? `/users/me/wishlist/${product.id}` : `/users/me/wishlist/${product.id}`, { method: currentlySaved ? 'DELETE' : 'POST' })
      const next = currentlySaved ? wishlisted.filter((id) => id !== product.id) : [...wishlisted, product.id]
      setWishlisted(next); onWishlistCountChange?.(next.length); setNotice(currentlySaved ? t('product.removedFromWishlist') : t('product.savedToWishlist'))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign in to save pieces to your wishlist.'); setNotice('') }
  }
  const colors = [...new Set(items.flatMap((product) => product.colors?.map((item) => item.name) ?? []))].sort()
  const sizes = [...new Set(items.flatMap((product) => product.variants?.map((item) => item.size) ?? []))].sort()
  const brands = [...new Set(items.map((product) => product.brand).filter((value): value is string => Boolean(value)))].sort()
  const seasons = [...new Set(items.map((product) => product.season).filter((value): value is string => Boolean(value)))].sort()

  const filterFields = <>
        <Select label={t('catalog.category')} value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setSubcategoryId('') }}><option value="">{t('catalog.allCategories')}</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.translations?.[locale]?.name || category.name}</option>)}</Select>
        <Select label={t('catalog.subcategory')} value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)}><option value="">{t('catalog.allSubcategories')}</option>{categories.filter((category) => !categoryId || category._id === categoryId).flatMap((category) => category.subcategories.map((sub) => <option key={sub._id} value={sub._id}>{sub.translations?.[locale]?.name || sub.name}</option>))}</Select>
        <Select label={t('catalog.color')} value={color} onChange={(event) => setColor(event.target.value)}><option value="">{t('catalog.allColors')}</option>{colors.map((item) => <option key={item}>{item}</option>)}</Select>
        <Select label={t('catalog.size')} value={size} onChange={(event) => setSize(event.target.value)}><option value="">{t('catalog.allSizes')}</option>{sizes.map((item) => <option key={item}>{item}</option>)}</Select>
        <Select label={t('catalog.brand')} value={brand} onChange={(event) => setBrand(event.target.value)}><option value="">{t('catalog.allBrands')}</option>{brands.map((item) => <option key={item}>{item}</option>)}</Select>
        <Select label={t('catalog.gender')} value={gender} onChange={(event) => setGender(event.target.value)}><option value="">{t('catalog.allFits')}</option>{[['women', t('catalog.women')], ['men', t('catalog.men')], ['unisex', t('catalog.unisex')], ['kids', t('catalog.kids')]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        <Select label={t('catalog.season')} value={season} onChange={(event) => setSeason(event.target.value)}><option value="">{t('catalog.allSeasons')}</option>{seasons.map((item) => <option key={item}>{item}</option>)}</Select>
        <fieldset className="catalog-price-filter"><legend>{t('catalog.priceRange')} ({businessConfig.currency})</legend><label><span className="sr-only">{t('catalog.min')}</span><input type="number" inputMode="decimal" min="0" step="0.01" placeholder={t('catalog.min')} value={minPrice} onChange={(event) => setMinPrice(event.target.value)} /></label><span aria-hidden="true">–</span><label><span className="sr-only">{t('catalog.max')}</span><input type="number" inputMode="decimal" min="0" step="0.01" placeholder={t('catalog.max')} value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></label></fieldset>
        <Select label={t('catalog.sort')} value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">{t('catalog.latest')}</option><option value="name_asc">{t('catalog.nameAZ')}</option><option value="price_asc">{t('catalog.lowHigh')}</option><option value="price_desc">{t('catalog.highLow')}</option></Select></>
  return <div className={`catalog ${showFilters ? '' : 'catalog--compact'}`}>
    <div className="catalog-toolbar">
      <label className="catalog-search"><span className="sr-only">{t('catalog.searchPlaceholder')}</span><input type="search" placeholder={t('catalog.searchPlaceholder')} value={search} onChange={(event) => setSearch(event.target.value)} /><span aria-hidden="true">⌕</span></label>
      <button className="catalog-filter-toggle" aria-expanded={filtersOpen} aria-haspopup="dialog" onClick={() => setFiltersOpen(!filtersOpen)}>{t('delight.filters')} <span aria-hidden="true">+</span></button><div className="catalog-filters catalog-filters--desktop">{filterFields}</div>
      <p className="catalog-count" role="status">{total} {total === 1 ? t('catalog.piece') : t('catalog.pieces')}</p>
    </div>
    {error && <p className="catalog-feedback catalog-feedback--error" role="alert">{error}{error.startsWith('Sign in') && <> <a href="/account/sign-in">Sign in</a></>}</p>}{notice && <p className="catalog-feedback" role="status">{notice}</p>}
    {loading ? <div className="product-grid product-grid--skeleton" aria-busy="true"><span className="sr-only" role="status">{t('catalog.finding')}</span>{Array.from({ length: limit ?? 8 }, (_, index) => <article className="product-skeleton" key={index}><Skeleton className="product-skeleton__image" /><Skeleton className="product-skeleton__line product-skeleton__line--short" /><Skeleton className="product-skeleton__line" /><Skeleton className="product-skeleton__line product-skeleton__line--price" /></article>)}</div> : loadError ? <EmptyState title={t('catalog.unavailable')} description={loadError} action={<Button variant="secondary" onClick={() => setRetryCount((value) => value + 1)}>{t('common.retry')}</Button>} /> : items.length ? <><ProductGrid products={items} wished={wishlisted} onWishlist={(product) => void toggleWishlist(product)} onAdd={(product, variant) => void add(product, variant)} onBuyNow={(product, variant) => void add(product, variant, true)} /><div className="catalog-pagination"><span>{t('catalog.pageCount', { page, pages })}</span><div><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t('common.previous')}</Button><Button variant="secondary" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>{t('common.next')}</Button></div></div></> : <EmptyState title={t('delight.noResults')} description={t('delight.retry')} action={<Button variant="secondary" onClick={() => { setSearch(''); setCategoryId(''); setSubcategoryId(''); setSize(''); setColor(''); setBrand(''); setGender(''); setSeason(''); setMinPrice(''); setMaxPrice('') }}>{t('common.clearFilters')}</Button>} />}
<Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t('delight.filters')}><div className="catalog-filters catalog-filters--drawer">{filterFields}</div><Button className="filter-show-results" onClick={() => setFiltersOpen(false)}>{t('delight.results')} · {total}</Button></Drawer>
    <span className="sr-only">Collection for {businessConfig.name}</span>
  </div>
}

export function mapProduct(item: RawProduct, locale: 'en' | 'bn' = 'en'): Product {
  const translation = item.translations?.[locale] ?? item.translations?.en
  const name = translation?.name || item.name
  const description = translation?.shortDescription || translation?.description || item.shortDescription || item.description
  const categoryName = item.categoryId?.translations?.[locale]?.name || item.categoryId?.translations?.en?.name || item.categoryId?.name
  const images = (item.media ?? []).filter((media) => media.kind === 'image').map((media) => ({ src: media.url, alt: media.alt || name, width: media.width, height: media.height, responsiveVariants: media.responsiveVariants }))
  const byColor = new Map<string, { name: string; value: string; images: Array<{ src: string; alt: string; width?: number; height?: number; responsiveVariants?: RawResponsiveImage[] }> }>()
  for (const variant of item.variants ?? []) {
    const entry = byColor.get(variant.color) ?? { name: variant.color, value: variant.colorCode || '#c8b9a5', images: [] }
    for (const image of variant.images ?? []) if (!entry.images.some((value) => value.src === image.url)) entry.images.push({ src: image.url, alt: image.alt || `${name} in ${variant.color}`, width: image.width, height: image.height, responsiveVariants: image.responsiveVariants })
    byColor.set(variant.color, entry)
  }
  const variants: ProductVariant[] = item.variants.map((variant) => ({ id: variant._id, sku: variant.sku, color: variant.color, colorCode: variant.colorCode, size: variant.size, price: variant.price, compareAtPrice: variant.compareAtPrice, currency: variant.currency, stock: variant.stock, available: variant.available, images: variant.images }))
  const lowest = variants.length ? Math.min(...variants.map((variant) => variant.price)) : item.price
  const discounted = item.discountPercent ? Math.round(lowest * (100 - item.discountPercent) / 100) : lowest
  return { id: item._id, name, slug: item.slug, category: categoryName || item.brand || 'Collection', brand: item.brand, gender: item.gender, season: item.season, description, material: item.material, fabric: item.fabric, price: discounted / 100, currency: variants[0]?.currency || businessConfig.currency, discountPercent: item.discountPercent, compareAt: discounted < lowest ? lowest / 100 : undefined, image: images[0]?.src || variants[0]?.images?.[0]?.url || '', alt: images[0]?.alt || name, imageWidth: images[0]?.width, imageHeight: images[0]?.height, imageResponsiveVariants: images[0]?.responsiveVariants, images, colors: [...byColor.values()], variants }
}


