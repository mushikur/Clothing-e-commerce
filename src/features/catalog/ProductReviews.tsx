import { useEffect, useState } from 'react'
import { Loading } from '../../components/ui'
import { useI18n } from '../../i18n/I18nProvider'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type Review = { _id: string; rating: number; title?: string; body: string; verifiedPurchase: boolean; createdAt: string; userId?: { name?: string } }
type ApiResult<T> = { success: boolean; data?: T }

export default function ProductReviews({ slug }: { slug: string }) {
  const { locale, t } = useI18n()
  const [reviews, setReviews] = useState<Review[]>([])
  const [average, setAverage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    const headers = new Headers()
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    fetch(`${apiBase}/products/${encodeURIComponent(slug)}/reviews`, { headers }).then((response) => response.json() as Promise<ApiResult<{ reviews: Review[]; averageRating: number; reviewCount: number }>>).then((result) => {
      if (!alive) return
      setReviews(result.data?.reviews ?? []); setAverage(result.data?.averageRating ?? 0); setTotal(result.data?.reviewCount ?? 0)
    }).catch(() => undefined).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [slug])
  return <section className="product-reviews section"><div className="product-reviews__inner"><div className="section-heading"><div><p className="eyebrow">{t('home.reviewsEyebrow')}</p><h2>{t('product.reviews')}</h2></div>{total > 0 && <p className="product-reviews__summary"><strong>★ {average.toFixed(1)}</strong> · {total} {t('product.reviews')}</p>}</div>{loading ? <div className="catalog-loading"><Loading label={t('home.reviewsEyebrow')} /></div> : reviews.length ? <div className="product-reviews__list">{reviews.map((review) => <article key={review._id}><div><strong>{review.title || review.rating}</strong><span className="product-reviews__stars" aria-label={`${review.rating} / 5`}>{'★'.repeat(review.rating)}<span>{'★'.repeat(5 - review.rating)}</span></span></div><p>{review.body}</p><small>{review.userId?.name || t('home.customer')} · {new Date(review.createdAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-BD')}{review.verifiedPurchase ? ` · ${t('home.verifiedPurchase')}` : ''}</small></article>)}</div> : <p className="product-reviews__empty">{t('home.reviewsEmpty')}</p>}</div></section>
}
