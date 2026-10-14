import type { Product, ProductVariant } from '../components/commerce'
import { addGuestCartItem, guestCartCount, publishCartItemAdded } from './guest-cart'
import { getAccessToken } from './session'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
export async function addToBag(product: Product, variant: ProductVariant, quantity = 1): Promise<number> {
  const source=(document.activeElement?.closest('.modal,.product-card,.product-detail,.wishlist-card')?.querySelector('img'))?.getBoundingClientRect()
  const origin=source?{x:source.left+source.width/2,y:source.top+source.height/2}:undefined
  if (!variant.available || !Number.isInteger(quantity) || quantity < 1 || quantity > Math.min(variant.stock, 99)) throw new Error('This quantity is unavailable.')
  const access = await getAccessToken()
  let count: number
  if (!access) {
    addGuestCartItem(variant.id, quantity)
    count = guestCartCount()
  } else {
    const headers = new Headers({ 'Content-Type': 'application/json', Authorization: `Bearer ${access}` })
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    const response = await fetch(`${apiBase}/cart/items`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ variantId: variant.id, quantity }) })
    const result = await response.json() as { success: boolean; data?: { itemCount: number }; error?: { message?: string } }
    if (!response.ok || !result.success || !result.data) throw new Error(result.error?.message || 'Unable to add this piece.')
    count = result.data.itemCount
  }
  announceBagAddition(product, variant, quantity, count,origin)
  return count
}
export function announceBagAddition(product: Product, variant: ProductVariant, quantity: number, count: number,origin?:{x:number;y:number}) {
  const image = product.colors?.find((color) => color.name === variant.color)?.images?.[0] || variant.images?.[0]
  publishCartItemAdded({ name: product.name, image: image?.url || image?.src || product.image, color: variant.color, size: variant.size, quantity, price: Math.round(variant.price * (100 - (product.discountPercent || 0)) / 100) / 100, currency: variant.currency })
  window.dispatchEvent(new CustomEvent('storefront-cart-count', { detail: { count } }))
  if(origin)window.dispatchEvent(new CustomEvent('fashion-cart-flight',{detail:{image:image?.url||image?.src||product.image,origin}}))
  return count
}
