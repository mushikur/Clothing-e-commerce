export function storefrontImageLoading(): 'lazy' | 'eager' {
  return typeof document === 'undefined' || document.documentElement.dataset.storefrontLazyImages !== 'false' ? 'lazy' : 'eager'
}
