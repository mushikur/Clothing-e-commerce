export type GuestCartLine = { variantId: string; quantity: number }
const storageKey = `fashion-guest-cart:${import.meta.env.VITE_BUSINESS_SLUG || 'store'}`
const previewKey = `${storageKey}:recent-item`
export type CartPreview = { name: string; image: string; color: string; size: string; quantity: number; price: number; currency: string }

export function publishCartItemAdded(item: CartPreview): void {
  try { localStorage.setItem(previewKey, JSON.stringify(item)) } catch { /* The cart event still updates the current page. */ }
  window.dispatchEvent(new CustomEvent<CartPreview>('storefront-cart-item-added', { detail: item }))
}

export function getRecentCartItem(): CartPreview | null {
  try {
    const item = JSON.parse(localStorage.getItem(previewKey) || 'null') as Partial<CartPreview> | null
    if (!item || typeof item.name !== 'string' || typeof item.image !== 'string' || typeof item.color !== 'string' || typeof item.size !== 'string' || !Number.isFinite(item.price) || typeof item.currency !== 'string') return null
    return { name: item.name, image: item.image, color: item.color, size: item.size, quantity: Number.isInteger(item.quantity) && item.quantity! > 0 ? item.quantity! : 1, price: item.price!, currency: item.currency }
  } catch { return null }
}

export function getGuestCart(): GuestCartLine[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]') as GuestCartLine[]
    return Array.isArray(parsed) ? parsed.filter((line) => /^[a-f\d]{24}$/i.test(line.variantId) && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 99) : []
  } catch { return [] }
}
function persist(lines: GuestCartLine[]) {
  localStorage.setItem(storageKey, JSON.stringify(lines))
  window.dispatchEvent(new CustomEvent('guest-cart-change', { detail: { count: lines.reduce((sum, line) => sum + line.quantity, 0) } }))
}
export function setGuestCartQuantity(variantId: string, quantity: number): GuestCartLine[] {
  const next = getGuestCart().map((line) => line.variantId === variantId ? { ...line, quantity } : line).filter((line) => line.quantity > 0)
  persist(next); return next
}
export function addGuestCartItem(variantId: string, quantity = 1): GuestCartLine[] {
  const lines = getGuestCart()
  const existing = lines.find((line) => line.variantId === variantId)
  if (existing) existing.quantity = Math.min(existing.quantity + quantity, 99)
  else lines.push({ variantId, quantity: Math.min(quantity, 99) })
  persist(lines); return lines
}
export function removeGuestCartItem(variantId: string): GuestCartLine[] {
  const next = getGuestCart().filter((line) => line.variantId !== variantId)
  persist(next); return next
}
export function clearGuestCart(): void { persist([]) }
export function guestCartCount(): number { return getGuestCart().reduce((sum, line) => sum + line.quantity, 0) }
