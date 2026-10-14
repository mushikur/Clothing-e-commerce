import { lazy, Suspense, useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/ui'
import { useBusinessConfig } from './StorefrontConfig'
import { SectionRenderer, type StoreSection } from './SectionRenderer'
import { useI18n } from '../../i18n/I18nProvider'
import { Reveal, ExperienceSkeleton } from '../../components/Experience'
import './home.css'

const ProductCatalog = lazy(() => import('../catalog/ProductCatalog'))
const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type Category = { _id: string; name: string; slug: string; translations?: { en?: { name?: string }; bn?: { name?: string } }; imageUrl?: string; subcategories: Array<{ _id: string; name: string; slug: string }> }
type ReviewHighlight = { _id: string; rating: number; title?: string; body: string; verifiedPurchase: boolean; userId?: { name?: string }; productId?: { name?: string; slug?: string } }
type ApiResult<T> = { success: boolean; data?: T }

function CategoryEdit() {
  const { locale, t } = useI18n()
  const [categories, setCategories] = useState<Category[]>([])
  useEffect(() => {
    let alive = true
    const headers = new Headers()
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    fetch(`${apiBase}/categories`, { headers }).then((response) => response.json() as Promise<ApiResult<{ categories: Category[] }>>).then((result) => { if (alive) setCategories(result.data?.categories ?? []) }).catch(() => undefined)
    return () => { alive = false }
  }, [])
  if (!categories.length) return null
  return <section className="home-category section"><div className="container"><div className="section-heading"><div><p className="eyebrow">{t('home.categoryEyebrow')}</p><h2>{t('home.categoryTitle')}</h2></div><a className="link-arrow" href="/shop">{t('home.exploreAll')} <Icon name="arrow" /></a></div><div className="home-category__grid">{categories.slice(0, 4).map((category, index) => <a className={`home-category__card home-category__card--${index + 1}`} href={`/category/${category.slug}`} key={category._id}>{category.imageUrl ? <img src={category.imageUrl} alt="" loading="lazy" decoding="async" /> : <span className="home-category__texture" aria-hidden="true" />}<span className="home-category__name">{category.translations?.[locale]?.name || category.name}<Icon name="arrow" /></span></a>)}</div></div></section>
}

function ReviewEdit() {
  const { t } = useI18n()
  const [reviews, setReviews] = useState<ReviewHighlight[]>([])
  useEffect(() => {
    let alive = true
    const headers = new Headers()
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    fetch(`${apiBase}/products/reviews/highlights`, { headers }).then((response) => response.json() as Promise<ApiResult<{ reviews: ReviewHighlight[] }>>).then((result) => { if (alive) setReviews(result.data?.reviews ?? []) }).catch(() => undefined)
    return () => { alive = false }
  }, [])
  return <section className="home-reviews section"><div className="container"><div className="section-heading"><div><p className="eyebrow">{t('home.reviewsEyebrow')}</p><h2>{t('home.reviewsTitle')}</h2></div></div>{reviews.length ? <div className="home-reviews__grid">{reviews.slice(0, 3).map((review) => <article className="home-review" key={review._id}><p className="home-review__stars" aria-label={`${review.rating} / 5`}>{'★'.repeat(review.rating)}<span>{'★'.repeat(5 - review.rating)}</span></p><h3>{review.title || t('home.reviewTitleFallback')}</h3><blockquote>{review.body}</blockquote><div><strong>{review.userId?.name || t('home.customer')}</strong>{review.verifiedPurchase && <span>{t('home.verifiedPurchase')}</span>}</div>{review.productId?.slug && <a href={`/products/${review.productId.slug}`}>{review.productId.name} <Icon name="arrow" /></a>}</article>)}</div> : <p className="home-reviews__empty">{t('home.reviewsEmpty')}</p>}</div></section>
}

function NewsletterSection() {
  const { config } = useBusinessConfig()
  const { t } = useI18n()
  return <section className="home-newsletter"><div className="container"><p className="eyebrow">{t('home.newsletterEyebrow')}</p><h2>{t('home.newsletterTitle')}</h2><p>{t('home.newsletterBody')}</p><form onSubmit={(event) => { event.preventDefault(); window.location.assign(config.supportEmail ? `mailto:${config.supportEmail}?subject=${encodeURIComponent(t('home.newsletterRequest'))}&body=${encodeURIComponent(t('home.newsletterRequest'))}` : '/contact') }}><label className="sr-only" htmlFor="home-newsletter-email">{t('common.email')}</label><input id="home-newsletter-email" type="email" placeholder={t('home.emailPlaceholder')} required /><button aria-label={t('home.newsletterRequest')}>{t('home.newsletterJoin')} <Icon name="arrow" /></button></form><small>{t('home.newsletterPrivacy')}</small></div></section>
}

function StaticHome({ onCartCountChange, onWishlistCountChange }: { onCartCountChange?: (count: number) => void; onWishlistCountChange?: (count: number) => void }) {
  const { config } = useBusinessConfig()
  const { t } = useI18n()
  return <>
    <section className="hero" id="collections"><div className="hero__image" role="img" aria-label={t('home.heroEyebrow')} /><div className="hero__shade" /><div className="container hero__content"><p className="eyebrow">{t('home.heroEyebrow')}</p><h1 className="display">{t('home.heroTitle')}</h1><p>{t('home.heroBody')}</p><div className="hero__actions"><Button size="lg" onClick={() => window.location.assign('/shop')}>{t('home.shopCollection')} <Icon name="arrow" /></Button><a href="/shop?sort=newest" className="hero__quiet-link">{t('common.newArrivals')} <Icon name="arrow" /></a></div></div><div className="hero__caption"><span>{t('home.heroCaption')}</span><span>{t('home.heroSubcaption')}</span></div></section>
    <section className="trust-strip"><div className="container trust-strip__inner"><div><Icon name="sparkle" /><span>{t('home.trustCraft')}</span></div><div><Icon name="truck" /><span>{t('home.trustDelivery')}</span></div><div><Icon name="check" /><span>{t('home.trustQuality')}</span></div></div></section>
    <CategoryEdit />
    <section className="section collection-section" id="new"><div className="container"><div className="section-heading"><div><p className="eyebrow">{t('home.arrivalsEyebrow')}</p><h2>{t('home.arrivalsTitle')}</h2></div><a className="link-arrow" href="/shop?sort=newest">{t('home.shopArrivals')} <Icon name="arrow" /></a></div><Suspense fallback={<ExperienceSkeleton />}><ProductCatalog onCartCountChange={onCartCountChange} onWishlistCountChange={onWishlistCountChange} limit={4} showFilters={false} initialSort="newest" /></Suspense></div></section>
    <section className="home-editorial"><div className="home-editorial__image" role="img" aria-label={t('home.editorialEyebrow')} /><div className="home-editorial__copy"><p className="eyebrow">{t('home.editorialEyebrow')}</p><h2 className="display">{t('home.editorialTitle')}</h2><p>{t('home.editorialBody')}</p><a className="link-arrow" href="/about">{t('home.readApproach')} <Icon name="arrow" /></a><span className="editorial__index">{t('home.editorialIndex')}</span></div></section>
    <section className="section home-collection"><div className="container"><div className="section-heading"><div><p className="eyebrow">{t('home.bestEyebrow')}</p><h2>{t('home.bestTitle')}</h2></div><p>{t('home.bestNote')}</p></div><Suspense fallback={<ExperienceSkeleton />}><ProductCatalog onCartCountChange={onCartCountChange} onWishlistCountChange={onWishlistCountChange} limit={4} showFilters={false} initialSort="best_selling" /></Suspense></div></section>
    <section className="home-trending"><div className="container"><div className="section-heading"><div><p className="eyebrow">{t('home.trendingEyebrow')}</p><h2>{t('home.trendingTitle')}</h2></div><p>{t('home.trendingNote')}</p></div><Suspense fallback={<ExperienceSkeleton />}><ProductCatalog onCartCountChange={onCartCountChange} onWishlistCountChange={onWishlistCountChange} limit={4} showFilters={false} initialSort="trending" /></Suspense></div></section>
    <section className="home-promotion section"><div className="container"><div className="section-heading"><div><p className="eyebrow">{t('home.offerEyebrow')}</p><h2>{t('home.offerTitle')}</h2></div><p>{t('home.offerNote')}</p></div><Suspense fallback={<ExperienceSkeleton />}><ProductCatalog onCartCountChange={onCartCountChange} onWishlistCountChange={onWishlistCountChange} limit={4} showFilters={false} discountedOnly /></Suspense></div></section>
    <section className="home-lookbook"><div className="home-lookbook__copy"><p className="eyebrow">{t('home.lookbookEyebrow')}</p><h2>{t('home.lookbookTitle')}</h2><p>{t('home.lookbookBody')}</p><a className="link-arrow" href="/shop">{t('home.exploreEdit')} <Icon name="arrow" /></a></div><div className="home-lookbook__image" role="img" aria-label={t('home.lookbookEyebrow')} /></section>
    <ReviewEdit />
    {config.instagramUrl && <section className="home-instagram"><div className="container"><p className="eyebrow">{t('home.instagramEyebrow')}</p><h2>{t('home.instagramTitle')}</h2><a href={config.instagramUrl} target="_blank" rel="noreferrer">{t('home.follow', { name: config.name })} <Icon name="arrow" /></a></div></section>}
    <NewsletterSection />
  </>
}

export default function HomeExperience(props: { onCartCountChange?: (count: number) => void; onWishlistCountChange?: (count: number) => void }) {
  const { t } = useI18n()
  const [sections, setSections] = useState<StoreSection[] | null>(null)
  useEffect(() => {
    let alive = true
    const headers = new Headers()
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    fetch(`${apiBase}/storefront/homepage`, { headers }).then((response) => response.json() as Promise<ApiResult<{ sections: StoreSection[] }>>).then((result) => { if (alive) setSections(result.data?.sections ?? []) }).catch(() => { if (alive) setSections([]) })
    return () => { alive = false }
  }, [])
  if (sections === null) return <div className="home-opening" aria-busy="true"><span className="sr-only" role="status">{t('delight.loading')}</span><div className="home-opening__hero"><ExperienceSkeleton kind="checkout" count={1} /></div><div className="container"><ExperienceSkeleton /></div></div>
  if (sections?.length) return <SectionRenderer sections={sections} />
  return <Reveal><StaticHome {...props} /></Reveal>
}
