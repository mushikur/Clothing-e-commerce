import { fetchWithSession } from '../../lib/session'
import { WorkspaceSkeleton } from '../../components/WorkspaceUI'
import { useInterfaceText } from '../../i18n/interface-text'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { businessConfig } from '../../config/business'
import { getAccessToken } from '../../lib/session'
import { navigateAdmin } from './admin-navigation'
import './admin-customizer.css'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
const pages = [['about', 'About'], ['contact', 'Contact'], ['faq', 'FAQ'], ['privacy', 'Privacy'], ['terms', 'Terms'], ['returns', 'Return policy'], ['refunds', 'Refund policy'], ['shipping', 'Shipping policy']] as const
type PageKey = typeof pages[number][0]
type PageTranslation = { title: string; summary: string; body: string; faqs: Array<{ question: string; answer: string }>; seoTitle: string; seoDescription: string }
type ContentPage = { _id?: string; pageKey: PageKey; slug: string; title: string; summary: string; body: string; faqs: Array<{ question: string; answer: string }>; translations?: { en?: Partial<PageTranslation>; bn?: Partial<PageTranslation> }; status: 'draft' | 'published'; seo: { title: string; description: string } }
type ApiResult<T> = { success: boolean; data?: T; error?: { message?: string } }
const defaultPage = (pageKey: PageKey): ContentPage => ({ pageKey, slug: pageKey, title: pages.find(([key]) => key === pageKey)?.[1] || 'Page', summary: '', body: '', faqs: [], status: 'draft', seo: { title: '', description: '' } })
function authHeaders(token: string, json = false) { const headers = new Headers(); if (token) headers.set('Authorization', `Bearer ${token}`); if (json) headers.set('Content-Type', 'application/json'); if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG); return headers }

export default function AdminContentExperience() {
  const text = useInterfaceText()

  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [allPages, setAllPages] = useState<ContentPage[]>([])
  const [pageKey, setPageKey] = useState<PageKey>('about')
  const [draft, setDraft] = useState<ContentPage>(defaultPage('about'))
  const [faqText, setFaqText] = useState('')
  const [bnFaqText, setBnFaqText] = useState('')
  const [brandName, setBrandName] = useState(businessConfig.name)
  const [contact, setContact] = useState<{ email?: string; phone?: string; address?: string }>({})
  const call = async <T,>(path: string, init: RequestInit = {}) => {
    const response = await fetchWithSession(`${apiBase}${path}`, { ...init, headers: authHeaders(token, Boolean(init.body)), credentials: 'include' })
    const result = await response.json() as ApiResult<T>
    if (!response.ok || !result.success) throw new Error(result.error?.message || 'The request could not be completed.')
    return result
  }
  useEffect(() => {
    let active = true
    getAccessToken().then(async (accessToken) => {
      if (!accessToken) throw new Error('Sign in with an admin account to manage store pages.')
      const profileResponse = await fetchWithSession(`${apiBase}/auth/me`, { headers: authHeaders(accessToken), credentials: 'include' })
      const profile = await profileResponse.json() as ApiResult<{ user: { role: string } }>
      if (!profileResponse.ok || !['super_admin', 'admin', 'manager'].includes(profile.data?.user.role || '')) throw new Error('This account cannot manage store content.')
      if (active) setToken(accessToken)
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Admin access is unavailable.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!token) return
    let active = true
    Promise.all([call<{ pages: ContentPage[] }>('/admin/content'), call<{ settings: { displayName: string; contact?: typeof contact } }>('/admin/settings/site')]).then(([pagesResult, settingsResult]) => {
      if (!active) return
      setAllPages(pagesResult.data?.pages ?? [])
      setBrandName(settingsResult.data?.settings.displayName || businessConfig.name)
      setContact(settingsResult.data?.settings.contact ?? {})
      const page = pagesResult.data?.pages.find((item) => item.pageKey === pageKey)
      if (page) { setDraft({ ...defaultPage(pageKey), ...page, seo: { ...defaultPage(pageKey).seo, ...page.seo } }); setFaqText((page.faqs ?? []).map((faq) => `${faq.question} | ${faq.answer}`).join('\n')) }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load store pages.') })
    return () => { active = false }
  }, [token])
  const choosePage = (key: PageKey) => {
    setPageKey(key)
    const page = allPages.find((item) => item.pageKey === key)
    setDraft(page ? { ...defaultPage(key), ...page, seo: { ...defaultPage(key).seo, ...page.seo } } : defaultPage(key))
    setFaqText((page?.faqs ?? []).map((faq) => `${faq.question} | ${faq.answer}`).join('\n'))
    setBnFaqText((page?.translations?.bn?.faqs ?? []).map((faq) => `${faq.question} | ${faq.answer}`).join('\n'))
    setNotice(''); setError('')
  }
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    const faqs = faqText.split('\n').map((line) => line.split('|')).filter((parts) => parts[0]?.trim() && parts.slice(1).join('|').trim()).map((parts) => ({ question: parts[0].trim(), answer: parts.slice(1).join('|').trim() }))
    try {
      const bnFaqs = bnFaqText.split('\n').map((line) => line.split('|')).filter((parts) => parts[0]?.trim() && parts.slice(1).join('|').trim()).map((parts) => ({ question: parts[0].trim(), answer: parts.slice(1).join('|').trim() }))
      const result = await call<{ page: ContentPage }>(`/admin/content/${pageKey}`, { method: 'PUT', body: JSON.stringify({ ...draft, pageKey, slug: pageKey, faqs: pageKey === 'faq' ? faqs : [], summary: draft.summary || undefined, translations: { en: { title: draft.title, summary: draft.summary, body: draft.body, faqs: pageKey === 'faq' ? faqs : [], seoTitle: draft.seo.title, seoDescription: draft.seo.description }, bn: { ...draft.translations?.bn, faqs: pageKey === 'faq' ? bnFaqs : [] } }, seo: Object.fromEntries(Object.entries(draft.seo).filter(([, value]) => value.trim())) }) })
      setDraft({ ...defaultPage(pageKey), ...result.data!.page, seo: { ...defaultPage(pageKey).seo, ...result.data!.page.seo } })
      setAllPages((current) => [...current.filter((page) => page.pageKey !== pageKey), result.data!.page])
      setNotice(draft.status === 'published' ? 'Page published to the storefront.' : 'Draft saved. This page is not visible to customers yet.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this page.') }
    finally { setSaving(false) }
  }
  const remove = async () => {
    if (!draft._id) return
    setSaving(true); setError(''); setNotice('')
    try { await call(`/admin/content/${pageKey}`, { method: 'DELETE' }); setAllPages((current) => current.filter((page) => page.pageKey !== pageKey)); setDraft(defaultPage(pageKey)); setFaqText(''); setBnFaqText(''); setNotice('Page removed from the storefront.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove this page.') }
    finally { setSaving(false) }
  }
  if (loading) return <div className="admin-studio"><WorkspaceSkeleton kind="table"/></div>
  if (!token) return <div className="admin-studio"><header><a href="/admin">{brandName}</a><h2>{text("Store pages")}</h2></header><p role="alert">{error}</p><Button onClick={() => window.location.assign('/account/sign-in')}>{text("Sign in")}</Button></div>
  return <div className="admin-studio"><header className="admin-studio__header"><div><p className="account-kicker">{text("Store content")}</p><h2>{text("Pages and policies")}</h2><p>{text("Write the information customers need, then publish it to the storefront.")}</p></div><div className="admin-studio__actions"><Button variant="secondary" onClick={() => navigateAdmin('/admin/theme')}>{text("Theme studio")}</Button><Button variant="secondary" onClick={() => navigateAdmin('/admin?view=settings')}>{text("Brand settings")}</Button></div></header>
    {error && <p role="alert" className="catalog-feedback catalog-feedback--error">{error}</p>}{notice && <p role="status" className="catalog-feedback">{notice}</p>}
    <div className="admin-content-layout"><nav className="admin-content-nav" aria-label={text("Pages")}>{pages.map(([key, title]) => <button key={key} className={key === pageKey ? 'is-active' : ''} onClick={() => choosePage(key)}><span>{title}</span><small>{allPages.find((page) => page.pageKey === key)?.status || 'Not created'}{!allPages.find((page) => page.pageKey === key)?.translations?.bn?.title && ' · বাংলা missing'}</small></button>)}</nav><form className="admin-content-form" onSubmit={(event) => void save(event)}><div className="admin-section-heading"><div><p className="account-kicker">{pages.find(([key]) => key === pageKey)?.[1]}</p><h2>{text("Edit page")}</h2></div><span className={`admin-pill ${draft.status === 'published' ? 'is-published' : ''}`}>{draft.status}</span></div><label>{text("Page title")}<input required minLength={2} maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label>{text("Short introduction")}<input maxLength={500} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></label>{pageKey === 'faq' && <label>{text("Questions and answers")}<small>One per line, separated by a vertical bar.</small><textarea rows={8} value={faqText} onChange={(event) => setFaqText(event.target.value)} placeholder={'How do I find my size? | See the size guide on each product page.'} /></label>}<label>{pageKey === 'faq' ? 'Additional page copy' : 'Page content'}<textarea rows={pageKey === 'faq' ? 8 : 16} maxLength={50000} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder={text("Write in plain text. Separate paragraphs with a blank line.")} /></label><fieldset><legend>বাংলা কনটেন্ট · Bangla content</legend><label>শিরোনাম<input lang="bn" maxLength={160} value={draft.translations?.bn?.title ?? ''} onChange={(event) => setDraft({ ...draft, translations: { ...draft.translations, bn: { ...draft.translations?.bn, title: event.target.value } } })} /></label><label>সংক্ষিপ্ত পরিচিতি<input lang="bn" maxLength={500} value={draft.translations?.bn?.summary ?? ''} onChange={(event) => setDraft({ ...draft, translations: { ...draft.translations, bn: { ...draft.translations?.bn, summary: event.target.value } } })} /></label>{pageKey === 'faq' && <label>প্রশ্ন ও উত্তর <small>প্রতি লাইনে একটি; প্রশ্ন ও উত্তরের মাঝে | দিন।</small><textarea lang="bn" rows={8} value={bnFaqText} onChange={(event) => setBnFaqText(event.target.value)} /></label>}<label>{pageKey === 'faq' ? 'অতিরিক্ত লেখা' : 'বিস্তারিত লেখা'}<textarea lang="bn" rows={pageKey === 'faq' ? 8 : 16} maxLength={50000} value={draft.translations?.bn?.body ?? ''} onChange={(event) => setDraft({ ...draft, translations: { ...draft.translations, bn: { ...draft.translations?.bn, body: event.target.value } } })} /></label><label>বাংলা SEO title<input lang="bn" maxLength={70} value={draft.translations?.bn?.seoTitle ?? ''} onChange={(event) => setDraft({ ...draft, translations: { ...draft.translations, bn: { ...draft.translations?.bn, seoTitle: event.target.value } } })} /></label><label>বাংলা SEO description<textarea lang="bn" rows={2} maxLength={170} value={draft.translations?.bn?.seoDescription ?? ''} onChange={(event) => setDraft({ ...draft, translations: { ...draft.translations, bn: { ...draft.translations?.bn, seoDescription: event.target.value } } })} /></label></fieldset><fieldset><legend>{text("Search preview")}</legend><label>{text("SEO title")}<input maxLength={70} value={draft.seo.title} onChange={(event) => setDraft({ ...draft, seo: { ...draft.seo, title: event.target.value } })} /></label><label>{text("SEO description")}<textarea rows={2} maxLength={170} value={draft.seo.description} onChange={(event) => setDraft({ ...draft, seo: { ...draft.seo, description: event.target.value } })} /></label></fieldset>{pageKey === 'contact' && <aside className="admin-content-contact"><strong>{brandName}</strong><span>{contact.email || 'Add an email in Brand settings'}</span><span>{contact.phone || 'Add a phone number in Brand settings'}</span><span>{contact.address || 'Add a business address in Brand settings'}</span></aside>}<div className="admin-form-row"><label>{text("Publishing status")}<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ContentPage['status'] })}><option value="draft">{text("Save as draft")}</option><option value="published">{text("Published")}</option></select></label><div className="admin-studio__actions"><Button disabled={saving}>{saving ? text("Saving…") : 'Save page'}</Button>{draft._id && <Button type="button" variant="secondary" disabled={saving} onClick={() => void remove()}>{text("Delete page")}</Button>}</div></div></form></div>
  </div>
}
