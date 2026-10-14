import { fetchWithSession } from '../../lib/session'
import { ThemeContrast } from '../../components/ThemeContrast'
import { WorkspaceSkeleton } from '../../components/WorkspaceUI'
import { useInterfaceText } from '../../i18n/interface-text'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Button } from '../../components/ui'
import { businessConfig } from '../../config/business'
import { getAccessToken } from '../../lib/session'
import { navigateAdmin } from './admin-navigation'
import './admin-customizer.css'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type Colors = Record<'primary' | 'secondary' | 'accent' | 'background' | 'surface' | 'text' | 'mutedText' | 'border' | 'success' | 'warning' | 'error', string>
type ThemeDraft = { _id?: string; name: string; preset: string; colors: Colors; typography: { displayFont: 'serif' | 'sans' | 'editorial'; bodyFont: 'sans' | 'serif' }; components: { buttonStyle: 'solid' | 'outline' | 'soft'; cardStyle: 'minimal' | 'bordered' | 'soft'; headerStyle: 'clean' | 'editorial'; footerStyle: 'minimal' | 'editorial'; radius: 'sharp' | 'soft' | 'rounded'; spacing: 'compact' | 'comfortable' | 'relaxed'; backgroundStyle: 'flat' | 'warm' | 'cool' } }
type ThemeRecord = ThemeDraft & { status: 'draft' | 'published' | 'archived'; version: number; _id: string }
type ApiResult<T> = { success: boolean; data?: T; error?: { message?: string } }
const presetData: Record<string, Omit<ThemeDraft, 'name' | '_id'>> = {
  luxury: { preset: 'luxury', colors: { primary: '#24211d', secondary: '#766d61', accent: '#805333', background: '#f6f2eb', surface: '#fffdf9', text: '#29251f', mutedText: '#625d55', border: '#e3dbcf', success: '#4d7055', warning: '#91601f', error: '#a1483e' }, typography: { displayFont: 'editorial', bodyFont: 'sans' }, components: { buttonStyle: 'solid', cardStyle: 'minimal', headerStyle: 'editorial', footerStyle: 'editorial', radius: 'sharp', spacing: 'relaxed', backgroundStyle: 'warm' } },
  minimal: { preset: 'minimal', colors: { primary: '#252525', secondary: '#727272', accent: '#5f6963', background: '#f8f8f6', surface: '#ffffff', text: '#242424', mutedText: '#696969', border: '#e4e4e0', success: '#4d7055', warning: '#91601f', error: '#a1483e' }, typography: { displayFont: 'sans', bodyFont: 'sans' }, components: { buttonStyle: 'outline', cardStyle: 'minimal', headerStyle: 'clean', footerStyle: 'minimal', radius: 'sharp', spacing: 'comfortable', backgroundStyle: 'flat' } },
  modern: { preset: 'modern', colors: { primary: '#202d35', secondary: '#586a72', accent: '#92503c', background: '#f2f5f4', surface: '#ffffff', text: '#1f2b31', mutedText: '#5b686d', border: '#d9e1e1', success: '#3f755c', warning: '#91601f', error: '#a1483e' }, typography: { displayFont: 'sans', bodyFont: 'sans' }, components: { buttonStyle: 'solid', cardStyle: 'soft', headerStyle: 'clean', footerStyle: 'minimal', radius: 'soft', spacing: 'comfortable', backgroundStyle: 'cool' } },
  streetwear: { preset: 'streetwear', colors: { primary: '#191919', secondary: '#555555', accent: '#9d321e', background: '#efefea', surface: '#ffffff', text: '#191919', mutedText: '#696969', border: '#d2d2cb', success: '#4d7055', warning: '#91601f', error: '#a1483e' }, typography: { displayFont: 'sans', bodyFont: 'sans' }, components: { buttonStyle: 'solid', cardStyle: 'bordered', headerStyle: 'clean', footerStyle: 'editorial', radius: 'sharp', spacing: 'compact', backgroundStyle: 'flat' } },
  elegant: { preset: 'elegant', colors: { primary: '#463947', secondary: '#6c606b', accent: '#805a57', background: '#f6f1f3', surface: '#fffdfd', text: '#352c35', mutedText: '#645b64', border: '#e5dce1', success: '#4d7055', warning: '#91601f', error: '#a1483e' }, typography: { displayFont: 'editorial', bodyFont: 'serif' }, components: { buttonStyle: 'soft', cardStyle: 'minimal', headerStyle: 'editorial', footerStyle: 'editorial', radius: 'rounded', spacing: 'relaxed', backgroundStyle: 'warm' } },
  classic: { preset: 'classic', colors: { primary: '#293d36', secondary: '#616e67', accent: '#745936', background: '#f4f1e9', surface: '#fffdf8', text: '#2b342f', mutedText: '#65675e', border: '#dedacd', success: '#4d7055', warning: '#91601f', error: '#a1483e' }, typography: { displayFont: 'serif', bodyFont: 'serif' }, components: { buttonStyle: 'outline', cardStyle: 'bordered', headerStyle: 'editorial', footerStyle: 'minimal', radius: 'sharp', spacing: 'relaxed', backgroundStyle: 'warm' } },
  dark_fashion: { preset: 'dark_fashion', colors: { primary: '#f3eee6', secondary: '#c0b6a9', accent: '#c08762', background: '#1e1d1c', surface: '#292725', text: '#f2eee8', mutedText: '#b4aca1', border: '#46413c', success: '#8ab392', warning: '#d9ad70', error: '#db8279' }, typography: { displayFont: 'editorial', bodyFont: 'sans' }, components: { buttonStyle: 'solid', cardStyle: 'bordered', headerStyle: 'clean', footerStyle: 'editorial', radius: 'sharp', spacing: 'comfortable', backgroundStyle: 'flat' } },
  premium_boutique: { preset: 'premium_boutique', colors: { primary: '#35332e', secondary: '#6b665d', accent: '#805744', background: '#f4f0e8', surface: '#fffefa', text: '#302e29', mutedText: '#666158', border: '#e0d9cc', success: '#4d7055', warning: '#91601f', error: '#a1483e' }, typography: { displayFont: 'serif', bodyFont: 'sans' }, components: { buttonStyle: 'solid', cardStyle: 'soft', headerStyle: 'editorial', footerStyle: 'minimal', radius: 'soft', spacing: 'relaxed', backgroundStyle: 'warm' } },
}
const colorLabels: Array<[keyof Colors, string]> = [['primary', 'Primary'], ['secondary', 'Secondary'], ['accent', 'Accent'], ['background', 'Background'], ['surface', 'Surface'], ['text', 'Text'], ['mutedText', 'Muted text'], ['border', 'Border'], ['success', 'Success'], ['warning', 'Warning'], ['error', 'Error']]
const emptyTheme = (): ThemeDraft => ({ name: 'Store theme', ...presetData.luxury })
function authHeaders(token: string, json = false) { const headers = new Headers(); if (token) headers.set('Authorization', `Bearer ${token}`); if (json) headers.set('Content-Type', 'application/json'); if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG); return headers }

export default function AdminThemeExperience() {
  const text = useInterfaceText()

  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [settingsName, setSettingsName] = useState(businessConfig.name)
  const [draft, setDraft] = useState<ThemeDraft>(emptyTheme())
  const [published, setPublished] = useState<ThemeRecord | null>(null)
  const [themeDraft, setThemeDraft] = useState<ThemeRecord | null>(null)
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop')

  const call = async <T,>(path: string, init: RequestInit = {}) => {
    const response = await fetchWithSession(`${apiBase}${path}`, { ...init, headers: authHeaders(token, Boolean(init.body)), credentials: 'include' })
    const result = await response.json() as ApiResult<T>
    if (!response.ok || !result.success) throw new Error(result.error?.message || 'The request could not be completed.')
    return result
  }
  useEffect(() => {
    let active = true
    getAccessToken().then(async (accessToken) => {
      if (!accessToken) throw new Error('Sign in with an admin account to customize the store.')
      const profileResponse = await fetchWithSession(`${apiBase}/auth/me`, { headers: authHeaders(accessToken), credentials: 'include' })
      const profile = await profileResponse.json() as ApiResult<{ user: { role: string } }>
      if (!profileResponse.ok || !['super_admin', 'admin', 'manager'].includes(profile.data?.user.role || '')) throw new Error('This account cannot publish themes.')
      if (active) setToken(accessToken)
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Admin access is unavailable.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!token) return
    let active = true
    Promise.all([call<{ themes: ThemeRecord[]; publishedTheme: ThemeRecord | null; draftTheme: ThemeRecord | null }>('/admin/themes'), call<{ settings: { displayName: string } }>('/admin/settings/site')]).then(([themeResult, settingsResult]) => {
      if (!active) return
      const current = themeResult.data?.draftTheme || themeResult.data?.publishedTheme
      setPublished(themeResult.data?.publishedTheme || null)
      setThemeDraft(themeResult.data?.draftTheme || null)
      if (current) setDraft({ _id: themeResult.data?.draftTheme?._id, name: current.name, preset: current.preset, colors: current.colors, typography: current.typography, components: current.components })
      setSettingsName(settingsResult.data?.settings.displayName || businessConfig.name)
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load theme settings.') })
    return () => { active = false }
  }, [token])
  const previewStyle = useMemo(() => {
    const radius: Record<string, string> = { sharp: '.12rem', soft: '.5rem', rounded: '1rem' }
    const style = { '--preview-primary': draft.colors.primary, '--preview-secondary': draft.colors.secondary, '--preview-accent': draft.colors.accent, '--preview-background': draft.colors.background, '--preview-surface': draft.colors.surface, '--preview-text': draft.colors.text, '--preview-muted': draft.colors.mutedText, '--preview-border': draft.colors.border, '--preview-radius': radius[draft.components.radius], '--preview-font': draft.typography.displayFont === 'sans' ? 'Arial, sans-serif' : 'Georgia, serif' } as CSSProperties
    return style
  }, [draft])
  const update = (change: Partial<ThemeDraft>) => setDraft((current) => ({ ...current, ...change }))
  const selectPreset = (key: string) => { const name = draft.name; setDraft({ ...presetData[key], name }) }
  const saveDraft = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await call<{ theme: ThemeRecord }>(themeDraft?._id ? `/admin/themes/${themeDraft._id}` : '/admin/themes', { method: themeDraft?._id ? 'PUT' : 'POST', body: JSON.stringify({ name: draft.name, preset: draft.preset, colors: draft.colors, typography: draft.typography, components: draft.components }) })
      setThemeDraft(result.data!.theme); setDraft({ ...draft, _id: result.data!.theme._id }); setNotice('Theme draft saved. Preview it, then publish when it is ready.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save theme draft.') }
    finally { setBusy(false) }
  }
  const publish = async () => {
    if (!themeDraft?._id) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await call<{ theme: ThemeRecord }>(`/admin/themes/${themeDraft._id}/publish`, { method: 'POST', body: JSON.stringify({}) })
      setPublished(result.data!.theme); setThemeDraft(null); setDraft({ name: result.data!.theme.name, preset: result.data!.theme.preset, colors: result.data!.theme.colors, typography: result.data!.theme.typography, components: result.data!.theme.components }); setNotice('Theme published to the storefront.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not publish theme.') }
    finally { setBusy(false) }
  }
  if (loading) return <div className="admin-studio"><WorkspaceSkeleton kind="table"/></div>
  if (!token) return <div className="admin-studio"><header><a href="/admin">{settingsName}</a><h2>{text("Theme studio")}</h2></header><p role="alert">{error}</p><Button onClick={() => window.location.assign('/account/sign-in')}>{text("Sign in")}</Button></div>
  return <div className="admin-studio"><header className="admin-studio__header"><div><p className="account-kicker">{text("Brand experience")}</p><h2>{text("Theme studio")}</h2><p>{text("Customize the storefront and review the changes before they go live.")}</p></div><div className="admin-studio__actions"><span className="admin-theme-status">{published ? `Live · v${published.version}` : 'No theme published'}</span><Button variant="secondary" onClick={() => navigateAdmin('/admin/content')}>{text("Manage content")}</Button><Button variant="secondary" disabled={busy} onClick={() => void saveDraft()}>{text("Save draft")}</Button><Button disabled={busy || !themeDraft?._id} onClick={() => void publish()}>{text("Publish theme")}</Button></div></header>
    {error && <p role="alert" className="catalog-feedback catalog-feedback--error">{error}</p>}{notice && <p role="status" className="catalog-feedback">{notice}</p>}
    <div className="admin-theme-layout"><section className="admin-theme-controls"><label>{text("Theme name")}<input value={draft.name} maxLength={100} onChange={(event) => update({ name: event.target.value })} /></label><label>{text("Preset")}<select value={draft.preset} onChange={(event) => selectPreset(event.target.value)}>{Object.keys(presetData).map((key) => <option key={key} value={key}>{text(key.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' '))}</option>)}</select></label><ThemeContrast text={draft.colors.text} surface={draft.colors.surface} primary={draft.colors.primary} background={draft.colors.background}/><section><h2>{text("Colors")}</h2><div className="admin-theme-swatches">{colorLabels.map(([key, label]) => <label key={key}><span>{text(label)}</span><input aria-label={text(label)} type="color" value={draft.colors[key]} onChange={(event) => update({ colors: { ...draft.colors, [key]: event.target.value } })} /><code>{draft.colors[key]}</code></label>)}</div></section><section><h2>{text("Typography")}</h2><div className="admin-theme-fields"><label>{text("Display")}<select value={draft.typography.displayFont} onChange={(event) => update({ typography: { ...draft.typography, displayFont: event.target.value as ThemeDraft['typography']['displayFont'] } })}><option value="editorial">{text("Editorial serif")}</option><option value="serif">{text("Classic serif")}</option><option value="sans">{text("Modern sans serif")}</option></select></label><label>{text("Body")}<select value={draft.typography.bodyFont} onChange={(event) => update({ typography: { ...draft.typography, bodyFont: event.target.value as ThemeDraft['typography']['bodyFont'] } })}><option value="sans">{text("Clean sans serif")}</option><option value="serif">{text("Classic serif")}</option></select></label></div></section><section><h2>{text("Storefront elements")}</h2><div className="admin-theme-fields">{([['buttonStyle', 'Buttons', ['solid', 'outline', 'soft']], ['cardStyle', 'Cards', ['minimal', 'bordered', 'soft']], ['headerStyle', 'Header', ['clean', 'editorial']], ['footerStyle', 'Footer', ['minimal', 'editorial']], ['radius', 'Corners', ['sharp', 'soft', 'rounded']], ['spacing', 'Spacing', ['compact', 'comfortable', 'relaxed']], ['backgroundStyle', 'Background tone', ['flat', 'warm', 'cool']]] as const).map(([key, label, options]) => <label key={key}>{text(label)}<select value={draft.components[key]} onChange={(event) => update({ components: { ...draft.components, [key]: event.target.value } as ThemeDraft['components'] })}>{options.map((option) => <option key={option} value={option}>{text(option[0].toUpperCase() + option.slice(1))}</option>)}</select></label>)}</div></section><p className="admin-theme-business">{text('Brand settings such as business name, logo, contact details, and social links are managed in')} <a href="/admin?view=settings">{text("Store settings")}</a>.</p></section>
      <section className="admin-theme-preview-wrap"><div className="admin-preview-toolbar"><div><p className="account-kicker">{text('Draft preview')}</p><strong>{settingsName}</strong><p className="admin-preview-note">{text('Sample content — changes apply after publishing.')}</p></div><div><button aria-pressed={previewWidth === 'desktop'} onClick={() => setPreviewWidth('desktop')}>{text("Desktop")}</button><button aria-pressed={previewWidth === 'mobile'} onClick={() => setPreviewWidth('mobile')}>{text("Mobile")}</button></div></div><div className={`admin-theme-preview ${previewWidth === 'mobile' ? 'is-mobile' : ''}`} style={previewStyle} data-button-style={draft.components.buttonStyle} data-card-style={draft.components.cardStyle}><div className="admin-preview-announcement">{text("A considered collection, made for now")}</div><div className="admin-preview-header"><span>{settingsName}</span><nav>{text("New arrivals　 The edit　 About")}</nav><span>{text("Search　 Bag")}</span></div><div className="admin-preview-hero"><div><small>{text("THE NEW SEASON")}</small><h2>{text("Form, feeling")}<br />{text("and the everyday.")}</h2><p>{text("Pieces selected for a life in motion.")}</p><button>{text("Explore the collection")}</button></div><div className="admin-preview-image" /></div><div className="admin-preview-products"><div><small>{text("THE EDIT")}</small><h3>{text("Considered essentials")}</h3></div>{['Relaxed cotton shirt', 'The everyday trouser', 'Soft structure jacket'].map((name, index) => <article key={name}><div className={`admin-preview-product-image image-${index}`} /><small>{text("NEW ARRIVAL")}</small><strong>{text(name)}</strong><span>$128</span></article>)}</div><footer>{text("Made to be worn often　 ·")}{settingsName}</footer></div><p className="admin-preview-caption">{text('Changes in this preview are still a draft. The published theme stays live until you publish this version.')}</p></section></div>
  </div>
}
