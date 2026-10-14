import { useEffect, useRef, useState } from 'react'
import animationData from '../assets/fashion-bag.json'
import { useReducedMotion } from '../lib/motion'

function BagFallback() {
  return <svg className="fashion-bag-animation__fallback" viewBox="0 0 180 160" aria-hidden="true">
    <path d="M53 57c0-21 13-35 37-35s37 14 37 35" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <path d="M37 53h106l-9 91H46l-9-91Z" fill="var(--color-accent-soft, #eee3d4)" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    <path d="m142 34 2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8Z" fill="var(--color-accent, #a96c45)" />
  </svg>
}

export function FashionBagAnimation() {
  const reducedMotion = useReducedMotion()
  const [loaded, setLoaded] = useState(false)
  const [visible, setVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    if (!('IntersectionObserver' in window)) { setVisible(true); return }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '80px' })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let disposed = false
    let destroy: (() => void) | undefined
    setLoaded(false)
    if (reducedMotion || !visible) return
    void import('lottie-web/build/player/lottie_light.min.js').then((module) => {
      const player = module.default ?? module
      const container = containerRef.current
      if (disposed || !container) return
      const instance = player.loadAnimation({ container, renderer: 'svg', loop: !reducedMotion, autoplay: !reducedMotion, animationData })
      const visibilityChanged = () => { if (document.hidden) instance.pause(); else instance.play() }
      document.addEventListener('visibilitychange', visibilityChanged)
      visibilityChanged()
      destroy = () => { document.removeEventListener('visibilitychange', visibilityChanged); instance.destroy() }
      setLoaded(true)
    }).catch(() => {
      // The static SVG below remains visible if the optional animation engine fails.
    })
    return () => { disposed = true; destroy?.() }
  }, [reducedMotion, visible])

  return <div className="fashion-bag-animation" aria-hidden="true">
    <div ref={containerRef} className="fashion-bag-animation__player" />
    {!loaded && <div className="fashion-bag-animation__fallback"><BagFallback /></div>}
  </div>
}
