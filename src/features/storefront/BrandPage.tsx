import { useInterfaceText } from '../../i18n/interface-text'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui'
import { useBusinessConfig } from './StorefrontConfig'
import { absoluteStorefrontUrl, setPageMetadata } from '../../lib/seo'
import './brand-page.css'
import { useI18n } from '../../i18n/I18nProvider'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type ContentPage = { pageKey: string; slug: string; title: string; summary?: string; body: string; faqs: Array<{ question: string; answer: string }>; translations?: { en?: { title?: string; summary?: string; body?: string; faqs?: Array<{ question: string; answer: string }>; seoTitle?: string; seoDescription?: string }; bn?: { title?: string; summary?: string; body?: string; faqs?: Array<{ question: string; answer: string }>; seoTitle?: string; seoDescription?: string } }; seo?: { title?: string; description?: string } }
const pageTitle: Record<string, string> = { about: 'About', contact: 'Contact', faq: 'Frequently asked questions', privacy: 'Privacy policy', terms: 'Terms and conditions', returns: 'Return policy', refunds: 'Refund policy', shipping: 'Shipping information' }
const faqFallback = [
  ['How do I find the right size?', 'Open a product page and use its size guide alongside the available size options.'],
  ['Where can I see my orders?', 'Sign in and open Orders in your account. Order details and carrier updates appear when they have been recorded.'],
  ['Can I change a saved address?', 'Sign in, open Addresses, and edit or remove a saved delivery address.'],
  ['How do I contact the store?', 'Use the support details listed here when the business has configured its contact information.'],
]
function pageSlug(page: string) { return page === 'return' ? 'returns' : page }
function bodyParagraphs(body?: string) { return (body || '').split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean) }

export default function BrandPage({ page }: { page: string }) {
  const text = useInterfaceText()

  const { config, settings } = useBusinessConfig()
  const { locale, t } = useI18n()
  const slug = pageSlug(page)
  const [content, setContent] = useState<ContentPage | null>(null)
  useEffect(() => {
    if (slug === 'policies') return
    let active = true
    const headers = new Headers()
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    fetch(`${apiBase}/storefront/pages/${encodeURIComponent(slug)}`, { headers }).then(async (response) => {
      if (!response.ok) return
      const result = await response.json() as { success?: boolean; data?: { page?: ContentPage } }
      if (active && result.success && result.data?.page) setContent(result.data.page)
    }).catch(() => undefined)
    return () => { active = false }
  }, [slug])
  useEffect(() => {
    const localized = content?.translations?.[locale] || content?.translations?.en
    const pageName = localized?.title || content?.title || pageTitle[slug] || 'Store information'
    setPageMetadata({ title: localized?.seoTitle || content?.seo?.title || `${pageName} | ${config.name}`, description: localized?.seoDescription || content?.seo?.description || localized?.summary || content?.summary || `Learn more about ${pageName.toLowerCase()} at ${config.name}.`, canonical: absoluteStorefrontUrl(`/${slug}`), image: settings.seo?.defaultImageUrl, type: 'article', structuredData: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: config.name, item: absoluteStorefrontUrl('/') }, { '@type': 'ListItem', position: 2, name: pageName, item: absoluteStorefrontUrl(`/${slug}`) }] } })
  }, [config.name, content, settings.seo?.defaultImageUrl, slug, locale])
  const localized = content?.translations?.[locale] || content?.translations?.en
  const title = localized?.title || content?.title || (page === 'about' ? (locale === 'bn' ? 'প্রতিদিনের জীবনের অংশ হয়ে উঠুক।' : 'Made to become part of your everyday.') : page === 'contact' ? (locale === 'bn' ? 'আমরা আছি আপনার পাশে।' : 'We’re here to help.') : page === 'faq' ? (locale === 'bn' ? 'আপনার কিছু দরকারি প্রশ্নের উত্তর।' : 'A few useful answers.') : page === 'policies' ? (locale === 'bn' ? 'দোকানের নীতিমালা।' : 'Store policies.') : t(`policy.${slug}`) || pageTitle[slug] || 'Store information')
  const body = localized?.body || content?.body
  const summary = localized?.summary || content?.summary
  const faqs = localized?.faqs || content?.faqs
  const paragraphs = bodyParagraphs(body)
  const policyKey=`policy.${slug}`
  const breadcrumbTitle=t(policyKey)===policyKey?text(pageTitle[slug]||'Store information'):t(policyKey)
  return <main className="brand-page"><nav className="product-breadcrumb" aria-label="Breadcrumb"><a href="/">{t('common.home')}</a><span>/</span><span aria-current="page">{breadcrumbTitle}</span></nav><header className="brand-page__hero"><p className="account-kicker">{config.name} · {locale === 'bn' ? 'গ্রাহকসেবা' : text("Client care")}</p><h1>{title}</h1>{summary ? <p>{summary}</p> : page === 'about' && !paragraphs.length && <p>{locale === 'bn' ? 'পোশাক বেছে নেওয়া হোক ভাবনাপূর্ণ ও সহজ। আমাদের কালেকশনে আছে যত্নে বাছাই করা, বারবার পরার মতো পোশাক।' : 'We believe getting dressed should feel thoughtful and uncomplicated. Our collection is shaped by considered details and pieces chosen to be worn often.'}</p>}</header>
    {page === 'policies' ? <section className="brand-policy-links"><p className="eyebrow">{t('footer.information')}</p><h2>{locale === 'bn' ? 'নীতিমালা বেছে নিন' : text("Choose a policy")}</h2><div>{[['privacy', t('policy.privacy')], ['terms', t('policy.terms')], ['returns', t('policy.returns')], ['refunds', t('policy.refunds')], ['shipping', t('policy.shipping')]].map(([href, label]) => <a key={href} href={`/${href}`}>{label}<span aria-hidden="true">↗</span></a>)}</div></section>
      : page === 'about' ? <section className="brand-story"><div className="brand-story__image" role="img" aria-label="A quiet studio moodboard of fabric and form" /><div><p className="eyebrow">{content ? text("Our story") : text("Our approach")}</p><h2>{content ? text("A point of view, made to be shared.") : text("Fewer pieces. More possibility.")}</h2>{paragraphs.length ? paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p>{text("Each collection is built around the way clothes move through real days: easy to wear, considered in detail, and made to work together. We keep the focus on form, fabric, and the feeling of a well-chosen piece.")}</p>}<Button onClick={() => window.location.assign('/shop')}>{text("Explore the collection")}</Button></div></section>
      : page === 'contact' ? <section className="brand-contact"><p className="eyebrow">{text("Personal service")}</p>{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}{settings.contact?.email ? <a className="brand-contact__email" href={`mailto:${settings.contact.email}`}>{settings.contact.email} <span aria-hidden="true">↗</span></a> : <><h2>{text("Contact details are being prepared.")}</h2><p>{text("This storefront has not configured a support email yet. Please check back later.")}</p></>}{settings.contact?.phone && <p><a href={`tel:${settings.contact.phone}`}>{settings.contact.phone}</a></p>}{settings.contact?.address && <p>{settings.contact.address}</p>}
      </section>
      : page === 'faq' ? <section className="brand-faq">{(faqs?.length ? faqs : faqFallback.map(([question, answer]) => ({ question:text(question), answer:text(answer) }))).map(({ question, answer }, index) => <details key={question}><summary><span>{String(index + 1).padStart(2, '0')}</span>{question}</summary><p>{answer}</p></details>)}{paragraphs.map((paragraph, index) => <p key={`body-${index}`}>{paragraph}</p>)}</section>
      : <section className="brand-policies"><p className="eyebrow">{t(`policy.${slug}`) || pageTitle[slug] || 'Store policy'}</p>{paragraphs.length ? paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <><h2>{locale === 'bn' ? 'নীতিমালাটি এখনো প্রকাশ করা হয়নি।' : 'This policy has not been published yet.'}</h2><p>{locale === 'bn' ? 'অর্ডার করার আগে এই নীতিমালা সম্পর্কে জানতে দোকানে যোগাযোগ করুন।' : `For current information about ${pageTitle[slug]?.toLowerCase() || 'this policy'}, contact the store before placing an order.`}</p></>}{settings.contact?.email && <a className="link-arrow" href={`mailto:${settings.contact.email}`}>{locale === 'bn' ? 'দোকানে জিজ্ঞাসা করুন' : 'Ask the store'} <span aria-hidden="true">↗</span></a>}</section>}
  </main>
}
