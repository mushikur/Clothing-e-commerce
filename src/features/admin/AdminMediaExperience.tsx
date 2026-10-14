import { fetchWithSession } from '../../lib/session'
import { WorkspaceSkeleton } from '../../components/WorkspaceUI'
import { useInterfaceText } from '../../i18n/interface-text'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { getAccessToken } from '../../lib/session'
import './admin-media.css'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type Result<T> = { success: boolean; data?: T; error?: { message?: string }; meta?: { page: number; pages: number; total: number } }
type ResponsiveVariant = { label: string; width: number; height: number; size: number; format: string; url: string }
type Media = { id: string; originalName: string; mimeType: string; format: string; width: number; height: number; originalWidth: number; originalHeight: number; originalSize: number; optimizedSize: number; storageBytes: number; storageSaved: number; storageSavedPercentage: number; quality: number; altText: string; originalUrl?: string; url: string; thumbnailUrl: string; srcSet: string; sizes: string; variants: ResponsiveVariant[]; isUsed: boolean; createdAt: string }
type Settings = { enabled: boolean; quality: number; maxWidth: number; maxHeight: number; preferredFormat: 'webp' | 'avif'; generateThumbnails: boolean; generateResponsiveSizes: boolean; keepOriginal: boolean; deleteUnusedImages: boolean; lazyLoading: boolean }
type Job = { id: string; type: string; status: 'queued' | 'running' | 'completed' | 'failed'; total: number; processed: number; failedCount: number; progress: number; lastError?: string }
type Stats = { totalImages: number; originalStorage: number; optimizedStorage: number; storageSaved: number; storageSavedPercentage: number; unusedImages: number; largestImages: Media[] }
const defaultSettings: Settings = { enabled: true, quality: 88, maxWidth: 2000, maxHeight: 2000, preferredFormat: 'webp', generateThumbnails: true, generateResponsiveSizes: true, keepOriginal: false, deleteUnusedImages: false, lazyLoading: true }
const bytes = (value: number) => value >= 1_000_000_000 ? `${(value / 1_000_000_000).toFixed(2)} GB` : value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1000))} KB`

export default function AdminMediaExperience() {
  const text = useInterfaceText()

  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [items, setItems] = useState<Media[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [settings, setSettings] = useState(defaultSettings)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'newest' | 'largest'>('newest')
  const [filter, setFilter] = useState<'all' | 'unused'>('all')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [job, setJob] = useState<Job | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [previewPair, setPreviewPair] = useState<{ original: string; optimized: string; name: string; originalSize: number; optimizedSize: number; quality: number } | null>(null)

  useEffect(() => {
    const objectUrl = previewPair?.original
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [previewPair?.original])

  const call = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<Result<T>> => {
    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
    const response = await fetchWithSession(`${apiBase}${path}`, { ...init, headers, credentials: 'include' })
    const result = await response.json() as Result<T>
    if (!response.ok || !result.success) throw new Error(result.error?.message || 'The media request could not be completed.')
    return result
  }, [token])

  const load = useCallback(async (currentPage = page) => {
    if (!token) return
    const params = new URLSearchParams({ page: String(currentPage), limit: '24', sort, filter })
    if (query.trim()) params.set('q', query.trim())
    const [list, dashboard] = await Promise.all([call<Media[]>(`/admin/media?${params}`), call<Stats>('/admin/media/stats')])
    setItems(list.data || []); setPages(list.meta?.pages || 1); setStats(dashboard.data || null)
  }, [call, filter, page, query, sort, token])

  useEffect(() => {
    let active = true
    getAccessToken().then(async (access) => {
      if (!access) throw new Error('Sign in with an admin account to manage store images.')
      const headers = new Headers({ Authorization: `Bearer ${access}` })
      if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
      const response = await fetchWithSession(`${apiBase}/auth/me`, { headers, credentials: 'include' })
      const profile = await response.json() as Result<{ user: { role: string } }>
      if (!response.ok || !['super_admin', 'admin', 'manager', 'staff'].includes(profile.data?.user.role || '')) throw new Error('This account cannot manage store media.')
      if (active) { setToken(access); setAuthorized(true) }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Media management is unavailable.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!authorized) return
    void call<{ settings: Settings }>('/admin/media/settings').then((result) => setSettings({ ...defaultSettings, ...(result.data?.settings || {}) })).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load image settings.'))
  }, [authorized, call])

  useEffect(() => { if (authorized) load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load the media library.')) }, [authorized, filter, load, page, query, sort])

  useEffect(() => {
    if (!job || ['completed', 'failed'].includes(job.status)) return
    const interval = window.setInterval(() => { void call<Job>(`/admin/media/jobs/${job.id}`).then((result) => { if (result.data) { setJob(result.data); if (['completed', 'failed'].includes(result.data.status)) { void load(); setNotice(result.data.status === 'completed' ? `Media task finished. ${result.data.failedCount} item(s) could not be processed.` : 'The media task failed.') } } }).catch(() => undefined) }, 1800)
    return () => window.clearInterval(interval)
  }, [call, job, load])

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    const selectedFiles = Array.from(files)
    setUploading(true); setUploadProgress(0); setError(''); setNotice(''); setUploadStatus('Preparing upload…')
    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index]!
        const previewUrl = URL.createObjectURL(file)
        setUploadStatus(`Optimizing ${index + 1} of ${selectedFiles.length}: ${file.name}`)
        const formData = new FormData(); formData.append('file', file); formData.append('altText', file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
        let result: Result<{ asset: Media; duplicate: boolean }>
        try { result = await call<{ asset: Media; duplicate: boolean }>('/admin/media/upload', { method: 'POST', body: formData }) }
        catch (cause) { URL.revokeObjectURL(previewUrl); throw cause }
        const asset = result.data!.asset
        setPreviewPair({ original: previewUrl, optimized: asset.url, name: file.name, originalSize: asset.originalSize, optimizedSize: asset.optimizedSize, quality: asset.quality })
        setUploadProgress(Math.round((index + 1) / selectedFiles.length * 100))
        setUploadStatus(result.data!.duplicate ? `${file.name} already exists; using the saved optimized copy.` : `${file.name} optimized and saved.`)
        await load()
      }
      setNotice(`${selectedFiles.length} image${selectedFiles.length === 1 ? '' : 's'} uploaded.`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Image upload failed.') }
    finally { setUploading(false); setUploadStatus('') }
  }

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setNotice('')
    try { await call('/admin/media/settings', { method: 'PUT', body: JSON.stringify(settings) }); setNotice('Image optimization settings saved.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save image settings.') }
  }
  const startJob = async (type: 'optimize' | 'delete_unused', assetIds?: string[]) => {
    setError(''); setNotice('')
    try { const result = await call<Job>('/admin/media/jobs', { method: 'POST', body: JSON.stringify({ type, ...(assetIds?.length ? { assetIds } : {}) }) }); setJob(result.data || null); setSelected([]); setNotice(type === 'optimize' ? 'Optimization task queued.' : 'Unused image cleanup queued.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start the media task.') }
  }
  const deleteImage = async (item: Media) => {
    if (!window.confirm(`Delete ${item.originalName}? This cannot be undone.`)) return
    try { await call(`/admin/media/${item.id}`, { method: 'DELETE' }); setNotice('Image deleted.'); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete this image.') }
  }
  const saveAltText = async (item: Media, altText: string) => {
    try { await call(`/admin/media/${item.id}`, { method: 'PATCH', body: JSON.stringify({ altText }) }); setItems((current) => current.map((row) => row.id === item.id ? { ...row, altText } : row)); setNotice('Image description saved.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save image description.') }
  }
  const selectedOnPage = useMemo(() => items.length > 0 && items.every((item) => selected.includes(item.id)), [items, selected])

  if (loading) return <div className="admin-media"><WorkspaceSkeleton kind="table"/></div>
  if (!authorized) return <div className="admin-media admin-console--login"><p className="account-kicker">{text("Store workspace")}</p><h2>{text("Media library")}</h2><p role="alert">{error || 'Sign in to manage store images.'}</p><Button onClick={() => window.location.assign('/account/sign-in')}>{text("Sign in")}</Button></div>

  return <div className="admin-media">
      {error && <p className="catalog-feedback catalog-feedback--error" role="alert">{error}</p>}{notice && <p className="catalog-feedback" role="status">{notice}</p>}
      {stats && <section className="admin-media__stats" aria-label={text("Storage summary")}><article><span>{text("Total images")}</span><strong>{stats.totalImages.toLocaleString()}</strong></article><article><span>{text("Original storage")}</span><strong>{bytes(stats.originalStorage)}</strong></article><article><span>{text("Storage on disk")}</span><strong>{bytes(stats.optimizedStorage)}</strong></article><article><span>{text("Space saved")}</span><strong>{bytes(stats.storageSaved)} <small>{stats.storageSavedPercentage}%</small></strong></article><article><span>{text("Unused images")}</span><strong>{stats.unusedImages.toLocaleString()}</strong></article></section>}
      <section className="admin-media__panel"><div><p className="account-kicker">{text("Automatic image treatment")}</p><h2>{text("Optimization settings")}</h2><p>High-quality WebP or AVIF files, resized without stretching and delivered from your configured media storage.</p></div><form className="admin-media__settings" onSubmit={(event) => void saveSettings(event)}>
        <label className="admin-media__toggle"><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} /> {text("Optimize uploads automatically")}</label>
        <label>{text("Quality")}<strong>{settings.quality}%</strong><input type="range" min="80" max="95" step="1" value={settings.quality} onChange={(event) => setSettings({ ...settings, quality: Number(event.target.value) })} /></label>
        <div className="admin-media__settings-grid"><label>{text("Maximum width")}<input type="number" min="300" max="4000" value={settings.maxWidth} onChange={(event) => setSettings({ ...settings, maxWidth: Number(event.target.value) })} /></label><label>{text("Maximum height")}<input type="number" min="300" max="4000" value={settings.maxHeight} onChange={(event) => setSettings({ ...settings, maxHeight: Number(event.target.value) })} /></label><label>{text("Preferred format")}<select value={settings.preferredFormat} onChange={(event) => setSettings({ ...settings, preferredFormat: event.target.value as Settings['preferredFormat'] })}><option value="webp">{text("WebP (recommended)")}</option><option value="avif">AVIF</option></select></label></div>
        <div className="admin-media__checks">{([['generateThumbnails', 'Generate thumbnails'], ['generateResponsiveSizes', 'Generate responsive sizes'], ['keepOriginal', 'Keep original uploads'], ['lazyLoading', 'Lazy load storefront images'], ['deleteUnusedImages', 'Allow unused image cleanup']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={settings[key]} onChange={(event) => setSettings({ ...settings, [key]: event.target.checked })} />{label}</label>)}</div><Button>{text("Save settings")}</Button>
      </form></section>
      <section className="admin-media__panel admin-media__upload"><div><p className="account-kicker">{text("Media intake")}</p><h2>{text("Upload images")}</h2><p>JPEG, PNG, WebP and AVIF · up to 12 MB per image · transparent PNGs remain transparent.</p>{uploadStatus && <p role="status">{uploadStatus}</p>}</div><label className={`admin-media__drop ${uploading ? 'is-busy' : ''} ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); if (!uploading) setDragging(true) }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!uploading) void upload(event.dataTransfer.files) }}><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={uploading} onChange={(event) => { void upload(event.target.files); event.currentTarget.value = '' }} /><span>{uploading ? 'Processing your images…' : dragging ? 'Drop images to upload' : 'Choose images or drop them here'}</span><small>{text("Images are checked by their file contents before processing.")}</small>{uploading && <progress value={uploadProgress} max="100" aria-label={`${uploadProgress}% uploaded`} />}</label></section>
      {previewPair && <section className="admin-media__preview" aria-label={text("Original and optimized comparison")}><div><p className="account-kicker">Quality check · {previewPair.quality}{text("% quality")}</p><h2>{text("Original vs optimized")}</h2><p>{bytes(previewPair.originalSize)} → {bytes(previewPair.optimizedSize)} · {previewPair.originalSize ? Math.max(0, Math.round((previewPair.originalSize - previewPair.optimizedSize) / previewPair.originalSize * 100)) : 0}{text("% saved")}</p></div><figure><img src={previewPair.original} alt={`Original upload ${previewPair.name}`} /><figcaption>Original · {bytes(previewPair.originalSize)}</figcaption></figure><figure><img src={previewPair.optimized} alt={`Optimized ${previewPair.name}`} /><figcaption>Optimized · {bytes(previewPair.optimizedSize)}</figcaption></figure><Button type="button" variant="secondary" onClick={() => setPreviewPair(null)}>{text("Close preview")}</Button></section>}
      {job && <section className="admin-media__job" role="status"><div><strong>{job.type === 'optimize' ? 'Image optimization' : 'Unused image cleanup'}</strong><span>{job.status === 'completed' ? 'Complete' : job.status === 'failed' ? 'Failed' : `${job.processed} of ${job.total} images`}</span></div><progress value={job.progress} max="100" aria-label={`${job.progress}% complete`} /><span>{job.progress}%</span>{job.lastError && <small>{job.lastError}</small>}</section>}
      <section className="admin-media__library"><header><div><p className="account-kicker">{text("Browse and manage")}</p><h2>{text("Images")}</h2></div><div className="admin-media__actions"><Button variant="secondary" disabled={!selected.length || Boolean(job && ['queued', 'running'].includes(job.status))} onClick={() => void startJob('optimize', selected)}>{text("Optimize selected")}</Button><Button variant="secondary" disabled={Boolean(job && ['queued', 'running'].includes(job.status))} onClick={() => void startJob('optimize')}>{text("Optimize all")}</Button><Button variant="secondary" disabled={!settings.deleteUnusedImages || !stats?.unusedImages || Boolean(job && ['queued', 'running'].includes(job.status))} onClick={() => void startJob('delete_unused')}>{text("Delete unused")}</Button></div></header>
        <div className="admin-media__toolbar"><input type="search" aria-label={text("Search images")} placeholder={text("Search file names")} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /><select aria-label={text("Filter images")} value={filter} onChange={(event) => { setFilter(event.target.value as typeof filter); setPage(1) }}><option value="all">{text("All images")}</option><option value="unused">{text("Unused images")}</option></select><select aria-label={text("Sort images")} value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setPage(1) }}><option value="newest">{text("Newest first")}</option><option value="largest">{text("Largest first")}</option></select><label><input type="checkbox" checked={selectedOnPage} onChange={(event) => setSelected(event.target.checked ? [...new Set([...selected, ...items.map((item) => item.id)])] : selected.filter((id) => !items.some((item) => item.id === id)))} /> {text("Select this page")}</label></div>
        {items.length ? <div className="admin-media__grid">{items.map((item) => <article className={`admin-media-card ${selected.includes(item.id) ? 'is-selected' : ''}`} key={item.id}><div className="admin-media-card__image"><img src={item.thumbnailUrl} srcSet={item.srcSet} sizes="(max-width: 760px) 50vw, 220px" width={item.width} height={item.height} loading="lazy" decoding="async" alt={item.altText || item.originalName} /><label><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))} aria-label={`Select ${item.originalName}`} /></label></div><div className="admin-media-card__body"><strong title={item.originalName}>{item.originalName}</strong><span>{item.width} × {item.height} · {item.format.toUpperCase()}</span><span>{bytes(item.originalSize)} {text("source ·")}{bytes(item.optimizedSize)} {text("variants ·")}{bytes(item.storageBytes)} {text("stored")}</span><span className={item.isUsed ? 'media-used' : 'media-unused'}>{item.isUsed ? 'In use' : 'Unused'}</span><label>{text("Alt text")}<input aria-label={`Alt text for ${item.originalName}`} defaultValue={item.altText} maxLength={250} onBlur={(event) => { if (event.target.value !== item.altText) void saveAltText(item, event.target.value) }} /></label><div className="admin-media-card__actions"><button type="button" onClick={() => { void navigator.clipboard.writeText(item.url).then(() => setNotice('Optimized image URL copied.')).catch(() => setError('Clipboard access is unavailable.')) }}>{text("Copy URL")}</button><button type="button" disabled={item.isUsed} onClick={() => void deleteImage(item)}>{text("Delete")}</button></div></div></article>)}</div> : <div className="admin-media__empty"><h3>{text("No images found")}</h3><p>{text("Upload a product or campaign image to begin building your media library.")}</p></div>}
        <nav className="admin-media__pagination" aria-label={text("Media library pages")}><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{text("Previous")}</Button><span>{text("Page")}{page} {text("of")}{pages}</span><Button variant="secondary" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>{text("Next")}</Button></nav>
      </section>
  </div>
}
