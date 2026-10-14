import { useEffect, useState } from 'react'

const preferenceKey = 'storefront-reduced-motion'
function readPreference() {
  const system = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  try { return system || localStorage.getItem(preferenceKey) === 'true' } catch { return system }
}
export function setReducedMotionPreference(enabled: boolean) {
  try { localStorage.setItem(preferenceKey, String(enabled)) } catch { /* The current page can still update. */ }
  document.documentElement.dataset.reducedMotion = String(enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  window.dispatchEvent(new Event('storefront-motion-preference'))
}
export function useReducedMotion() {
  const [reduced, setReduced] = useState(readPreference)
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { const value = readPreference(); setReduced(value); document.documentElement.dataset.reducedMotion = String(value) }
    update()
    preference.addEventListener('change', update)
    window.addEventListener('storefront-motion-preference', update)
    return () => { preference.removeEventListener('change', update); window.removeEventListener('storefront-motion-preference', update) }
  }, [])
  return reduced
}
