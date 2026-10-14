import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react'
import type { ClothingSizeGuideProps } from './ClothingSizeGuide'
import { useI18n } from '../i18n/I18nProvider'
import { Icon } from './Icon'
import { Skeleton } from './ui'
const ClothingSizeGuide = lazy(()=>import('./ClothingSizeGuide'))

export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { element.classList.add('reveal--visible'); observer.disconnect() }
    }, { threshold: .08 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} className={`reveal ${className}`}>{children}</div>
}

export function ExperienceSkeleton({ kind = 'products', count = 4 }: { kind?: 'products' | 'cart' | 'order' | 'checkout' | 'search'; count?: number }) {
  const { t } = useI18n()
  return <div className={`experience-skeleton experience-skeleton--${kind}`} aria-busy="true" role="status"><span className="sr-only">{t('delight.loading')}</span>{Array.from({ length: count }, (_, index) => <div className="experience-skeleton__item" key={index}><Skeleton className="experience-skeleton__image" /><div><Skeleton className="experience-skeleton__title" /><Skeleton className="experience-skeleton__line" /><Skeleton className="experience-skeleton__price" /></div></div>)}</div>
}

export function SuccessMark() {
  return <div className="success-mark" aria-hidden="true"><Icon name="check" /><span /><span /></div>
}

export function StoreTrust() {
  const { t } = useI18n()
  return <section className="trust-strip"><div className="container trust-strip__inner"><a href="/shipping"><Icon name="truck" /><span>{t('delight.delivery')}</span></a><a href="/returns"><Icon name="check" /><span>{t('delight.returns')}</span></a><a href="/contact"><Icon name="user" /><span>{t('common.contact')}</span></a></div></section>
}

export function SizeGuide(props: ClothingSizeGuideProps) {
  return props.open ? <Suspense fallback={null}><ClothingSizeGuide {...props}/></Suspense> : null
}

export function CheckoutProgress({ complete = false, current = 0 }: { complete?: boolean; current?: number }) {
  const { t } = useI18n()
  return <ol className="checkout-progress" aria-label={t('checkout.steps')}>{['details', 'address', 'payment', 'confirmed'].map((step, index) => <li key={step} className={complete || index < current ? 'is-complete' : index === current ? 'is-current' : ''} aria-current={!complete && index === current ? 'step' : complete && index === 3 ? 'step' : undefined}><span>{complete || index < current ? <Icon name="check" /> : `0${index + 1}`}</span>{t(`delight.${step}`)}</li>)}</ol>
}
