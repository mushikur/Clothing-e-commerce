import { fetchWithSession } from '../../lib/session'
import { useEffect, useState } from 'react'
import { ProductGrid, type Product, type ProductVariant } from '../../components/commerce'
import { FashionBagAnimation } from '../../components/FashionBagAnimation'
import { ExperienceSkeleton } from '../../components/Experience'
import { Button, EmptyState } from '../../components/ui'
import { announceBagAddition } from '../../lib/shopping'
import { getAccessToken } from '../../lib/session'
import { mapProduct, type RawProduct } from '../catalog/ProductCatalog'
import { useI18n } from '../../i18n/I18nProvider'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type ApiResult<T> = { success: boolean; data?: T; error?: { message?: string } }

export default function WishlistExperience({ onCartCountChange, onWishlistCountChange }: { onCartCountChange?: (count: number) => void; onWishlistCountChange?: (count: number) => void }) {
  const { locale, t } = useI18n()
  const [products, setProducts] = useState<Product[]>([])
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const headersFor = (access: string) => {
    const headers = new Headers({ Authorization: `Bearer ${access}` })
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    return headers
  }

  const loadWishlist = async (access: string, alive?: () => boolean) => {
    const wishlistResponse = await fetchWithSession(`${apiBase}/users/me/wishlist`, { headers: headersFor(access), credentials: 'include' })
    const wishlist = await wishlistResponse.json() as ApiResult<{ products: Array<{ _id: string; slug: string }> }>
    if (!wishlistResponse.ok || !wishlist.success) throw new Error(wishlist.error?.message || 'Unable to load your wishlist.')
    const items = await Promise.all((wishlist.data?.products ?? []).map(async (item) => {
      const headers = new Headers()
      if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
      const response = await fetchWithSession(`${apiBase}/products/${encodeURIComponent(item.slug)}`, { headers, credentials: 'include' })
      const result = await response.json() as ApiResult<RawProduct>
      if (!response.ok || !result.success || !result.data) return null
      return mapProduct(result.data, locale)
    }))
    if (alive && !alive()) return
    const visible = items.filter((item): item is Product => item !== null)
    setProducts(visible)
    onWishlistCountChange?.(visible.length)
  }

  useEffect(() => {
    let alive = true
    getAccessToken().then(async (accessToken) => {
      if (!accessToken) throw new Error('Sign in to see your saved pieces.')
      if (!alive) return
      setToken(accessToken); setSignedIn(true)
      await loadWishlist(accessToken, () => alive)
    }).catch((cause: unknown) => { if (alive) setError(cause instanceof Error ? cause.message : 'Sign in to see your saved pieces.') }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [locale])

  const authorized = async (path: string, method: 'POST' | 'DELETE', body?: unknown) => {
    const headers = headersFor(token)
    if (body) headers.set('Content-Type', 'application/json')
    const response = await fetchWithSession(`${apiBase}${path}`, { method, headers, credentials: 'include', ...(body ? { body: JSON.stringify(body) } : {}) })
    const result = await response.json() as ApiResult<unknown>
    if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to complete that request.')
    return result
  }
  const remove = async (product: Product) => {
    setError(''); setNotice('')
    try { await authorized(`/users/me/wishlist/${product.id}`, 'DELETE'); const next = products.filter((item) => item.id !== product.id); setProducts(next); onWishlistCountChange?.(next.length); setNotice(t('product.removedFromWishlist')) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update your wishlist.') }
  }
  const add = async (product: Product, variant?: ProductVariant, buyNow = false) => {
    if (!variant) { setNotice(t('product.chooseVariant')); return }
    if (buyNow) { window.location.assign(`/checkout?buyNow=${encodeURIComponent(variant.id)}`); return }
    setError(''); setNotice('')
    try {
      const response = await fetchWithSession(`${apiBase}/users/me/wishlist/${product.id}/move-to-cart`, { method: 'POST', headers: new Headers([...headersFor(token), ['Content-Type', 'application/json']]), credentials: 'include', body: JSON.stringify({ variantId: variant.id, quantity: 1 }) })
      const result = await response.json() as ApiResult<{ itemCount: number }>
      if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to move this piece to your bag.')
      onCartCountChange?.(result.data?.itemCount ?? 0)
      announceBagAddition(product, variant, 1, result.data?.itemCount ?? 0)
      const next = products.filter((item) => item.id !== product.id)
      setProducts(next); onWishlistCountChange?.(next.length); setNotice(t('product.addedVariant', { name: product.name, color: variant.color, size: variant.size }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to add this piece to your bag.') }
  }

  return <section className="section wishlist-page"><div className="container"><div className="section-heading"><div><p className="eyebrow">{t('account.wishlistEyebrow')}</p><h1>{t('account.wishlistTitle')}</h1></div><a className="link-arrow" href="/shop">{t('account.wishlistContinue')} <span aria-hidden="true">↗</span></a></div>{error && <p className="catalog-feedback catalog-feedback--error" role="alert">{error}{!signedIn && <> <a href="/account/sign-in">{t('account.signIn')}</a></>}</p>}{notice && <p className="catalog-feedback" role="status">{notice}</p>}{loading ? <ExperienceSkeleton /> : !signedIn ? <EmptyState title={t('account.wishlistSignInTitle')} description={t('account.wishlistSignInText')} action={<Button onClick={() => window.location.assign('/account/sign-in')}>{t('account.signIn')}</Button>} /> : products.length ? <ProductGrid products={products} wished={products.map((product) => product.id)} onWishlist={(product) => void remove(product)} onAdd={(product, variant) => void add(product, variant)} onBuyNow={(product, variant) => void add(product, variant, true)} /> : <EmptyState illustration={<FashionBagAnimation />} title={t('delight.emptyWish')} description={t('account.wishlistEmptyText')} action={<Button variant="secondary" onClick={() => window.location.assign('/shop')}>{t('account.wishlistExplore')}</Button>} />}</div></section>
}
