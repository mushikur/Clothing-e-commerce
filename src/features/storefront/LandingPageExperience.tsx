import { useEffect, useState } from 'react'
import { Button, EmptyState, Loading } from '../../components/ui'
import { SectionRenderer, type StoreSection } from './SectionRenderer'
import { useBusinessConfig } from './StorefrontConfig'
import { absoluteStorefrontUrl, setPageMetadata } from '../../lib/seo'
import { useI18n } from '../../i18n/I18nProvider'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type LandingData = { page: { slug: string; title: string; summary?: string; translations?: { en?: { title?: string; summary?: string; seoTitle?: string; seoDescription?: string }; bn?: { title?: string; summary?: string; seoTitle?: string; seoDescription?: string } }; seo?: { title?: string; description?: string } }; sections: StoreSection[] }
type Result = { success: boolean; data?: LandingData }
export default function LandingPageExperience({ slug }: { slug: string }) {
  const { config } = useBusinessConfig()
  const { locale, t } = useI18n()
  const [data, setData] = useState<LandingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    let alive = true
    const headers = new Headers()
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    fetch(`${apiBase}/storefront/landing/${encodeURIComponent(slug)}`, { headers }).then(async (response) => {
      const result = await response.json() as Result
      if (!response.ok || !result.success || !result.data) throw new Error('missing')
      if (alive) setData(result.data)
    }).catch(() => { if (alive) setMissing(true) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [slug])
  const localized = data?.page.translations?.[locale] || data?.page.translations?.en
  const title = localized?.title || data?.page.title
  const summary = localized?.summary || data?.page.summary
  useEffect(() => { if (!data || !title) return; const canonical = absoluteStorefrontUrl(`/${data.page.slug}`); setPageMetadata({ title: localized?.seoTitle || data.page.seo?.title || `${title} | ${config.name}`, description: localized?.seoDescription || data.page.seo?.description || summary || `Explore ${title} from ${config.name}.`, canonical, type: 'website', structuredData: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: config.name, item: absoluteStorefrontUrl('/') }, { '@type': 'ListItem', position: 2, name: title, item: canonical }] } }) }, [data, config.name, locale, title, summary, localized])
  if (loading) return <section className="section"><div className="container"><Loading label={t('catalog.finding')} /></div></section>
  if (missing || !data) return <section className="section"><div className="container"><EmptyState title={t('product.notFound')} description={t('landing.notPublished')} action={<Button onClick={() => window.location.assign('/shop')}>{t('header.collection')}</Button>} /></div></section>
  return <><header className="landing-heading"><div className="container"><p className="eyebrow">{config.name}</p><h1>{title}</h1>{summary && <p>{summary}</p>}</div></header><SectionRenderer sections={data.sections} /></>
}
