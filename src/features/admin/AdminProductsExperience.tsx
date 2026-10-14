import { DeleteRecordButton } from './AdminManagement'
import { fetchWithSession } from '../../lib/session'
import { WorkspaceSkeleton } from '../../components/WorkspaceUI'
import { ResponsiveTable } from '../../components/WorkspaceUI'
import { useInterfaceText } from '../../i18n/interface-text'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Button,Modal } from '../../components/ui'
import { businessConfig } from '../../config/business'
import { getAccessToken } from '../../lib/session'
import './admin-products.css'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
type ApiResult<T> = { success: boolean; data?: T; error?: { message?: string }; meta?: { pages: number; total: number } }
type Subcategory = { _id: string; name: string; slug: string; categoryId: string; status: string; translations?: { en?: { name?: string }; bn?: { name?: string } } }
type Category = { _id: string; name: string; slug: string; status: string; translations?: { en?: { name?: string }; bn?: { name?: string } }; subcategories?: Subcategory[] }
type VariantDraft = { color: string; size: string; sku: string; price: string; compareAtPrice: string; stock: string; currency: string; images: string[]; isActive: boolean }
type ColorDraft = { name: string; code: string; images: string }
type ResponsiveVariant = { label: string; width: number; height: number; format: string; url: string }
type ImageMetadata = { width: number; height: number; responsiveVariants: ResponsiveVariant[] }
type LocalizedProduct = { name?: string; shortDescription?: string; description?: string; slug?: string; seoTitle?: string; seoDescription?: string }
type ProductRecord = { _id: string; name: string; slug: string; sku: string; categoryId: string | { _id: string; name?: string }; subcategoryId?: string | { _id: string; name?: string }; description?: string; shortDescription?: string; translations?: { en?: LocalizedProduct; bn?: LocalizedProduct }; brand?: string; tags?: string[]; price: number; discountPercent?: number; costPrice?: number; material?: string; fabric?: string; gender?: string; season?: string; collection?: string; status: 'draft' | 'published' | 'archived'; updatedAt?: string; media?: Array<{ kind: string; url: string; alt?: string; sortOrder: number; width?: number; height?: number; responsiveVariants?: ResponsiveVariant[] }>; seo?: { title?: string; description?: string; canonicalUrl?: string }; variants: Array<{ sku: string; color: string; colorCode?: string; size: string; price: number; compareAtPrice?: number; stock: number; currency: string; images?: Array<{ url: string; alt?: string; width?: number; height?: number; responsiveVariants?: ResponsiveVariant[] }>; isActive: boolean }> }
const blank = { name: '', slug: '', sku: '', categoryId: '', subcategoryId: '', description: '', shortDescription: '', bnName: '', bnSlug: '', bnDescription: '', bnShortDescription: '', bnSeoTitle: '', bnSeoDescription: '', brand: '', tags: '', price: '', discountPercent: '0', costPrice: '', material: '', fabric: '', gender: 'unspecified', season: '', collection: '', status: 'draft', imageUrls: '', videoUrls: '', seoTitle: '', seoDescription: '', canonicalUrl: '' }
const slugify = (text: string) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const cleanImages = (text: string) => text.split(/\n|,/).map((url) => url.trim()).filter(Boolean)

export default function AdminProductsExperience() {
  const text = useInterfaceText()

  const [token, setToken] = useState('')
  const tokenRef = useRef('')
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('updated_desc')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(blank)
  const [imageMetadata, setImageMetadata] = useState<Record<string, ImageMetadata>>({})
  const [colors, setColors] = useState<ColorDraft[]>([{ name: '', code: '#222222', images: '' }])
  const [sizes, setSizes] = useState('S, M, L, XL')
  const [variants, setVariants] = useState<VariantDraft[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [bulkCollection, setBulkCollection] = useState('')
  const [bulkBrand, setBulkBrand] = useState('')
  const [bulkTags, setBulkTags] = useState('')
  const [bulkSeason, setBulkSeason] = useState('')
  const [bulkMaterial, setBulkMaterial] = useState('')
  const [bulkDiscount, setBulkDiscount] = useState('')
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkStatus, setBulkStatus] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newCategoryBn, setNewCategoryBn] = useState('')
  const [newSubcategory, setNewSubcategory] = useState('')
  const [newSubcategoryBn, setNewSubcategoryBn] = useState('')
  const [categoryForSub, setCategoryForSub] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const call = useCallback(async <T,>(path: string, init: RequestInit = {}, suppliedToken?: string): Promise<ApiResult<T>> => {
    const headers = new Headers(init.headers)
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    const access = suppliedToken || tokenRef.current
    if (access) headers.set('Authorization', `Bearer ${access}`)
    if (init.body) headers.set('Content-Type', 'application/json')
    const response = await fetchWithSession(`${apiBase}${path}`, { ...init, headers, credentials: 'include' })
    const result = await response.json() as ApiResult<T>
    if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to complete the admin request.')
    return result
  }, [])

  const loadData = useCallback(async (access: string, currentPage = page, search = query, status = statusFilter, sort = sortOrder) => {
    const params = new URLSearchParams({ page: String(currentPage), limit: '30' })
    if (search) params.set('q', search)
    if (status) params.set('status', status)
    params.set('sort', sort)
    const [productResponse, categoryResponse] = await Promise.all([call<ProductRecord[]>(`/admin/products?${params}`, {}, access), call<{ categories: Category[]; subcategories: Subcategory[] }>('/admin/categories', {}, access)])
    setProducts(productResponse.data ?? []); setPages(productResponse.meta?.pages ?? 1)
    const categoryTree = categoryResponse.data?.categories ?? []
    const subcategories = categoryResponse.data?.subcategories ?? []
    setCategories(categoryTree.map((category) => ({ ...category, subcategories: subcategories.filter((sub) => String(sub.categoryId) === category._id) })))
  }, [call, page, query, statusFilter, sortOrder])

  useEffect(() => {
    let alive = true
    getAccessToken().then(async (access) => {
      if (!access) throw new Error('Sign in with an administrator account to continue.')
      const profile = await call<{ user: { role: string } }>('/auth/me', {}, access)
      if (!['super_admin', 'admin', 'manager', 'staff'].includes(profile.data!.user.role)) throw new Error('This account does not have product management access.')
      if (alive) { tokenRef.current = access; setToken(access); setAuthorized(true); await loadData(access) }
    }).catch((cause: unknown) => { if (alive) setError(cause instanceof Error ? cause.message : 'Sign in with an administrator account to continue.') }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [call])

  const run = async (action: () => Promise<void>) => { setSaving(true); setError(''); setMessage(''); try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save changes.') } finally { setSaving(false) } }
  const matrixKeys = useMemo(() => variants.map((variant) => `${variant.color}:${variant.size}`), [variants])
  const buildMatrix = () => {
    const sizesList = [...new Set(sizes.split(',').map((value) => value.trim().toUpperCase()).filter(Boolean))]
    const prior = new Map(variants.map((variant) => [`${variant.color.toLowerCase()}|${variant.size.toUpperCase()}`, variant]))
    const matrix = colors.filter((color) => color.name.trim()).flatMap((color) => sizesList.map((size) => {
      const key = `${color.name.trim().toLowerCase()}|${size}`
      return prior.get(key) ?? { color: color.name.trim(), size, sku: `${form.sku}-${slugify(color.name)}-${size}`.toUpperCase().slice(0, 80), price: form.price, compareAtPrice: '', stock: '0', currency: businessConfig.currency, images: cleanImages(color.images), isActive: true }
    }))
    setVariants(matrix)
  }

  const editProduct = async (id: string) => run(async () => {
    const result = await call<ProductRecord>(`/admin/products/${id}`)
    const item = result.data!
    const productCategoryId = typeof item.categoryId === 'string' ? item.categoryId : item.categoryId._id
    setEditingId(id)
    const metadata: Record<string, ImageMetadata> = {}
    for (const image of [...(item.media || []), ...item.variants.flatMap((variant) => variant.images || [])]) if (image.width && image.height && image.responsiveVariants?.length) metadata[image.url] = { width: image.width, height: image.height, responsiveVariants: image.responsiveVariants }
    setImageMetadata(metadata)
    setForm({ ...blank, name: item.name, slug: item.slug, sku: item.sku, categoryId: productCategoryId, subcategoryId: typeof item.subcategoryId === 'string' ? item.subcategoryId : item.subcategoryId?._id ?? '', description: item.description ?? '', shortDescription: item.shortDescription ?? '', bnName: item.translations?.bn?.name ?? '', bnSlug: item.translations?.bn?.slug ?? '', bnDescription: item.translations?.bn?.description ?? '', bnShortDescription: item.translations?.bn?.shortDescription ?? '', bnSeoTitle: item.translations?.bn?.seoTitle ?? '', bnSeoDescription: item.translations?.bn?.seoDescription ?? '', brand: item.brand ?? '', tags: item.tags?.join(', ') ?? '', price: (item.price / 100).toFixed(2), discountPercent: String(item.discountPercent ?? 0), costPrice: item.costPrice == null ? '' : (item.costPrice / 100).toFixed(2), material: item.material ?? '', fabric: item.fabric ?? '', gender: item.gender ?? 'unspecified', season: item.season ?? '', collection: item.collection ?? '', status: item.status, imageUrls: item.media?.filter((media) => media.kind === 'image').map((media) => media.url).join('\n') ?? '', videoUrls: item.media?.filter((media) => media.kind === 'video').map((media) => media.url).join('\n') ?? '', seoTitle: item.seo?.title ?? '', seoDescription: item.seo?.description ?? '', canonicalUrl: item.seo?.canonicalUrl ?? '' })
    const colorMap = new Map<string, ColorDraft>()
    for (const variant of item.variants) {
      if (!colorMap.has(variant.color)) colorMap.set(variant.color, { name: variant.color, code: variant.colorCode ?? '#222222', images: variant.images?.map((image) => image.url).join('\n') ?? '' })
    }
    setColors([...colorMap.values()].length ? [...colorMap.values()] : [{ name: '', code: '#222222', images: '' }])
    setSizes([...new Set(item.variants.map((variant) => variant.size))].join(', '))
    setVariants(item.variants.map((variant) => ({ color: variant.color, size: variant.size, sku: variant.sku, price: (variant.price / 100).toFixed(2), compareAtPrice: variant.compareAtPrice == null ? '' : (variant.compareAtPrice / 100).toFixed(2), stock: String(variant.stock), currency: variant.currency, images: variant.images?.map((image) => image.url) ?? [], isActive: variant.isActive })))
    setEditorOpen(true)
  })

  const saveProduct = (event: FormEvent<HTMLFormElement>) => run(async () => {
    event.preventDefault()
    const finalVariants = variants.map((variant) => {
      const color = colors.find((item) => item.name.toLowerCase() === variant.color.toLowerCase())
      return { sku: variant.sku, color: variant.color, colorCode: color?.code, size: variant.size, price: toMinor(variant.price), compareAtPrice: variant.compareAtPrice ? toMinor(variant.compareAtPrice) : undefined, currency: variant.currency, stock: Number(variant.stock), images: (color ? cleanImages(color.images) : variant.images).map((url, sortOrder) => ({ url, alt: `${form.name} in ${variant.color}`, sortOrder, ...imageMetadata[url] })), isActive: variant.isActive }
    })
    if (!finalVariants.length) throw new Error('Build at least one color and size combination first.')
    const media = [...cleanImages(form.imageUrls).map((url, sortOrder) => ({ kind: 'image', url, alt: form.name, sortOrder, ...imageMetadata[url] })), ...cleanImages(form.videoUrls).map((url, sortOrder) => ({ kind: 'video', url, alt: form.name, sortOrder }))]
    const body = { name: form.name, slug: form.slug, sku: form.sku, categoryId: form.categoryId, ...(form.subcategoryId ? { subcategoryId: form.subcategoryId } : {}), description: form.description, shortDescription: form.shortDescription, translations: { en: { name: form.name, slug: form.slug, shortDescription: form.shortDescription, description: form.description, seoTitle: form.seoTitle, seoDescription: form.seoDescription }, bn: { name: form.bnName, slug: form.bnSlug, shortDescription: form.bnShortDescription, description: form.bnDescription, seoTitle: form.bnSeoTitle, seoDescription: form.bnSeoDescription } }, brand: form.brand, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean), price: toMinor(form.price), discountPercent: Number(form.discountPercent), ...(form.costPrice ? { costPrice: toMinor(form.costPrice) } : {}), media, material: form.material, fabric: form.fabric, gender: form.gender, season: form.season, collection: form.collection, status: form.status, seo: { ...(form.seoTitle ? { title: form.seoTitle } : {}), ...(form.seoDescription ? { description: form.seoDescription } : {}), ...(form.canonicalUrl ? { canonicalUrl: form.canonicalUrl } : {}) }, variants: finalVariants }
    await call(editingId ? `/admin/products/${editingId}` : '/admin/products', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(body) })
    setEditorOpen(false); setEditingId(''); setMessage(editingId ? 'Product updated.' : 'Product created.'); await loadData(token)
  })

  const duplicate = (item: ProductRecord) => run(async () => {
    const suffix = Math.random().toString(36).slice(2, 6)
    await call(`/admin/products/${item._id}/duplicate`, { method: 'POST', body: JSON.stringify({ slug: `${item.slug}-copy-${suffix}`, sku: `${item.sku}-COPY-${suffix}` }) })
    setMessage(`${item.name} duplicated as a draft.`); await loadData(token)
  })
  const uploadProductImages = async (files: FileList | null) => {
    if (!files?.length) return
    setSaving(true); setError(''); setMessage('')
    try {
      for (const file of Array.from(files)) {
        const data = new FormData(); data.append('file', file); data.append('altText', form.name || file.name.replace(/\.[^.]+$/, ''))
        const headers = new Headers({ Authorization: `Bearer ${tokenRef.current}` })
        if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
        const response = await fetchWithSession(`${apiBase}/admin/media/upload`, { method: 'POST', headers, body: data, credentials: 'include' })
        const result = await response.json() as ApiResult<{ asset: { url: string; width: number; height: number; variants: ResponsiveVariant[] } }>
        if (!response.ok || !result.success || !result.data) throw new Error(result.error?.message || 'The image could not be uploaded.')
        const asset = result.data.asset
        setForm((current) => ({ ...current, imageUrls: [...new Set([...cleanImages(current.imageUrls), asset.url])].join('\n') }))
        setImageMetadata((current) => ({ ...current, [asset.url]: { width: asset.width, height: asset.height, responsiveVariants: asset.variants } }))
      }
      setMessage('Images uploaded and optimized. Responsive sizes are saved with the product images.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The images could not be uploaded.') }
    finally { setSaving(false) }
  }
  const bulkEdit = () => run(async () => {
    const changes: Record<string, unknown> = {}
    if (bulkCollection.trim()) changes.collection = bulkCollection.trim()
    if (bulkBrand.trim()) changes.brand = bulkBrand.trim()
    if (bulkTags.trim()) changes.tags = bulkTags.split(',').map((tag) => tag.trim()).filter(Boolean)
    if (bulkSeason.trim()) changes.season = bulkSeason.trim()
    if (bulkMaterial.trim()) changes.material = bulkMaterial.trim()
    if (bulkDiscount !== '') changes.discountPercent = Number(bulkDiscount)
    if (bulkCategory) changes.categoryId = bulkCategory
    if (bulkStatus) changes.status = bulkStatus
    if (!Object.keys(changes).length) throw new Error('Choose a collection or status to update.')
    await call('/admin/products/bulk-edit', { method: 'POST', body: JSON.stringify({ productIds: selected, changes }) })
    setSelected([]); setBulkCollection(''); setBulkBrand(''); setBulkTags(''); setBulkSeason(''); setBulkMaterial(''); setBulkDiscount(''); setBulkCategory(''); setBulkStatus(''); setMessage('Selected products updated.'); await loadData(token)
  })
  const createCategory = () => run(async () => {
    if (!newCategory.trim()) return
    const slug = slugify(newCategory)
    const result = await call<{ category: Category }>('/admin/categories', { method: 'POST', body: JSON.stringify({ name: newCategory.trim(), slug, translations: { en: { name: newCategory.trim() }, bn: { name: newCategoryBn.trim() } } }) })
    setNewCategory(''); setNewCategoryBn(''); setMessage('Category created.'); await loadData(token); setForm((current) => ({ ...current, categoryId: result.data!.category._id }))
  })
  const createSubcategory = () => run(async () => {
    if (!categoryForSub || !newSubcategory.trim()) return
    await call('/admin/categories/subcategories', { method: 'POST', body: JSON.stringify({ categoryId: categoryForSub, name: newSubcategory.trim(), slug: slugify(newSubcategory), translations: { en: { name: newSubcategory.trim() }, bn: { name: newSubcategoryBn.trim() } } }) })
    setNewSubcategory(''); setNewSubcategoryBn(''); setMessage('Subcategory created.'); await loadData(token)
  })

  useEffect(() => { if (!token || !authorized) return; void loadData(token, page, query, statusFilter, sortOrder).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load products.')) }, [token, authorized, page, query, statusFilter, sortOrder, loadData])

  if (loading) return <div className="admin-page"><div className="catalog-loading"><WorkspaceSkeleton kind="table"/></div></div>
  if (!authorized) return <div className="admin-page"><div className="admin-blocked"><p className="account-kicker">{text("Product studio")}</p><h2>{text("Administrator access required.")}</h2><p>{error || 'Sign in with an administrator account to manage this collection.'}</p><Button onClick={() => window.location.assign('/account/sign-in')}>{text("Sign in")}</Button></div></div>

  return <div className="admin-page"><div className="admin-heading"><div><p className="account-kicker">{text("Commerce management")}</p><h2>{text("Product studio")}</h2><p>{text("Build collections, size runs, imagery, and stock.")}</p></div><Button onClick={() => { setEditingId(''); setForm(blank); setImageMetadata({}); setVariants([]); setColors([{ name: '', code: '#222222', images: '' }]); setEditorOpen(true) }}>{text("Create product")}<span aria-hidden="true">＋</span></Button></div>
    {error && <p className="catalog-feedback catalog-feedback--error" role="alert">{error}</p>}{message && <p className="catalog-feedback" role="status">{message}</p>}
    <section className="admin-category-tools"><div><p className="eyebrow">Categories · English + বাংলা</p><form onSubmit={(event) => { event.preventDefault(); void createCategory() }}><input placeholder={text("New category name (English)")} value={newCategory} onChange={(event) => setNewCategory(event.target.value)} /><input lang="bn" placeholder="বাংলা ক্যাটাগরির নাম" value={newCategoryBn} onChange={(event) => setNewCategoryBn(event.target.value)} /><Button variant="secondary" disabled={saving}>{text("Add category")}</Button></form></div><div><p className="eyebrow">Subcategories · English + বাংলা</p><form onSubmit={(event) => { event.preventDefault(); void createSubcategory() }}><select value={categoryForSub} onChange={(event) => setCategoryForSub(event.target.value)} aria-label={text("Parent category")}><option value="">{text("Choose category")}</option>{categories.filter((category) => category.status === 'active').map((category) => <option value={category._id} key={category._id}>{category.name}</option>)}</select><input placeholder={text("New subcategory name (English)")} value={newSubcategory} onChange={(event) => setNewSubcategory(event.target.value)} /><input lang="bn" placeholder="বাংলা সাবক্যাটাগরির নাম" value={newSubcategoryBn} onChange={(event) => setNewSubcategoryBn(event.target.value)} /><Button variant="secondary" disabled={saving}>{text("Add subcategory")}</Button></form></div></section>
    <section className="admin-list"><div className="admin-list__toolbar"><input type="search" placeholder={text("Search products or SKU")} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /><select aria-label={text("Filter by status")} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}><option value="">{text("All statuses")}</option><option value="draft">{text("Draft")}</option><option value="published">{text("Published")}</option><option value="archived">{text("Archived")}</option></select><select aria-label={text("Sort products")} value={sortOrder} onChange={(event) => { setSortOrder(event.target.value); setPage(1) }}><option value="updated_desc">{text("Recently updated")}</option><option value="name_asc">{text("Name A–Z")}</option><option value="name_desc">{text("Name Z–A")}</option><option value="price_asc">{text("Price low to high")}</option><option value="price_desc">{text("Price high to low")}</option></select><span>{products.length} {text("products on this page")}</span></div>{selected.length > 0 && <div className="admin-bulk"><strong>{selected.length} {text("selected")}</strong><input placeholder={text("Set collection")} value={bulkCollection} onChange={(event) => setBulkCollection(event.target.value)} /><input placeholder={text("Set brand")} value={bulkBrand} onChange={(event) => setBulkBrand(event.target.value)} /><input placeholder={text("Set tags, comma separated")} value={bulkTags} onChange={(event) => setBulkTags(event.target.value)} /><input placeholder={text("Set season")} value={bulkSeason} onChange={(event) => setBulkSeason(event.target.value)} /><input placeholder={text("Set material")} value={bulkMaterial} onChange={(event) => setBulkMaterial(event.target.value)} /><input type="number" min="0" max="100" step="1" aria-label={text("Set discount percent")} placeholder={text("Discount %")} value={bulkDiscount} onChange={(event) => setBulkDiscount(event.target.value)} /><select aria-label={text("Bulk category")} value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)}><option value="">{text("Keep category")}</option>{categories.filter((category) => category.status === 'active').map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select><select aria-label={text("Bulk status")} value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}><option value="">{text("Keep status")}</option><option value="draft">{text("Draft")}</option><option value="published">{text("Published")}</option><option value="archived">{text("Archived")}</option></select><Button variant="secondary" disabled={saving} onClick={bulkEdit}>{text("Apply changes")}</Button></div>}
      <div className="admin-table-wrap"><ResponsiveTable className="admin-table"><thead><tr><th><span className="sr-only">{text("Select")}</span></th><th>{text("Product")}</th><th>{text("SKU")}</th><th>{text("Category")}</th><th>{text("Price")}</th><th>{text("Status")}</th><th>{text("Updated")}</th><th><span className="sr-only">{text("Actions")}</span></th></tr></thead><tbody>{products.map((item) => <tr key={item._id}><td><input type="checkbox" checked={selected.includes(item._id)} onChange={(event) => setSelected((values) => event.target.checked ? [...values, item._id] : values.filter((id) => id !== item._id))} aria-label={`Select ${item.name}`} /></td><td><button className="admin-product-name" onClick={() => void editProduct(item._id)}>{item.name}</button></td><td>{item.sku}</td><td>{typeof item.categoryId === 'string' ? '—' : item.categoryId?.name}</td><td>{money(item.price, businessConfig.currency)}</td><td><span className={`admin-status admin-status--${item.status}`}>{item.status}</span></td><td>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}</td><td className="admin-row-actions"><button onClick={() => void editProduct(item._id)}>{text("Edit")}</button><button onClick={() => void duplicate(item)}>{text("Duplicate")}</button>{item.status !== 'archived' && <DeleteRecordButton kind="product" recordKey={item._id} name={item.name} onDeleted={()=>{setSelected(rows=>rows.filter(id=>id!==item._id));void loadData(token)}}/>}</td></tr>)}</tbody></ResponsiveTable>{products.length === 0 && <div className="admin-empty"><p>{text("No products match this view.")}</p><Button variant="secondary" onClick={() => { setQuery(''); setStatusFilter('') }}>{text("Clear filters")}</Button></div>}</div><div className="catalog-pagination"><span>{text("Page")}{page} {text("of")}{pages}</span><div><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>{text("Previous")}</Button><Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>{text("Next")}</Button></div></div>
    </section>
    <Modal open={editorOpen} onClose={()=>setEditorOpen(false)} title={text(editingId?'Edit product':'Create product')} className="admin-editor-dialog"><form onSubmit={saveProduct} className="admin-product-form">
      <fieldset><legend>{text("Product information")}</legend><div className="admin-form-grid"><Field label={text("Name")}><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, slug: editingId ? form.slug : slugify(event.target.value) })} /></Field><Field label={text("Slug")}><input required value={form.slug} onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })} /></Field><Field label={text("Product SKU")}><input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value.toUpperCase() })} /></Field><Field label={text("Category")}><select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value, subcategoryId: '' })}><option value="">{text("Choose category")}</option>{categories.filter((category) => category.status === 'active').map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></Field><Field label={text("Subcategory")}><select value={form.subcategoryId} onChange={(event) => setForm({ ...form, subcategoryId: event.target.value })}><option value="">{text("None")}</option>{categories.find((category) => category._id === form.categoryId)?.subcategories?.filter((sub) => sub.status !== 'inactive').map((sub) => <option key={sub._id} value={sub._id}>{sub.name}</option>)}</select></Field><Field label={text("Brand")}><input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></Field><Field label={text("Price (store currency)")}><input type="number" step="0.01" min="0" required value={form.price} onChange={(event) => { setForm({ ...form, price: event.target.value }); setVariants((rows) => rows.map((row) => ({ ...row, price: event.target.value }))) }} /></Field><Field label={text("Discount (%)")}><input type="number" min="0" max="100" step="1" value={form.discountPercent} onChange={(event) => setForm({ ...form, discountPercent: event.target.value })} /></Field><Field label={text("Cost price")}><input type="number" step="0.01" min="0" value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: event.target.value })} /></Field><Field label={text("Status")}><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">{text("Draft")}</option><option value="published">{text("Published")}</option><option value="archived">{text("Archived")}</option></select></Field><Field label={text("Gender")}><select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}>{['unspecified','women','men','unisex','kids'].map((option) => <option key={option} value={option}>{option}</option>)}</select></Field><Field label={text("Material")}><input value={form.material} onChange={(event) => setForm({ ...form, material: event.target.value })} /></Field><Field label={text("Fabric")}><input value={form.fabric} onChange={(event) => setForm({ ...form, fabric: event.target.value })} /></Field><Field label={text("Season")}><input value={form.season} onChange={(event) => setForm({ ...form, season: event.target.value })} /></Field><Field label={text("Collection")}><input value={form.collection} onChange={(event) => setForm({ ...form, collection: event.target.value })} /></Field><Field label={text("Tags (comma separated)")}><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></Field></div><Field label={text("Short description")}><textarea rows={2} value={form.shortDescription} onChange={(event) => setForm({ ...form, shortDescription: event.target.value })} /></Field><Field label={text("Description")}><textarea rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field></fieldset>
      <fieldset className="bilingual-editor"><legend>বাংলা কনটেন্ট · Bangla content</legend><p>বাংলা ভাষার ক্রেতাদের জন্য আলাদা পণ্যের তথ্য লিখুন। অনুবাদ খালি থাকলে ইংরেজি তথ্য দেখানো হবে।</p><Field label="নাম"><input lang="bn" value={form.bnName} onChange={(event) => setForm({ ...form, bnName: event.target.value })} /></Field><Field label="বাংলা স্লাগ (ঐচ্ছিক)"><input lang="bn" value={form.bnSlug} onChange={(event) => setForm({ ...form, bnSlug: event.target.value })} /></Field><Field label="সংক্ষিপ্ত বিবরণ"><textarea lang="bn" rows={2} value={form.bnShortDescription} onChange={(event) => setForm({ ...form, bnShortDescription: event.target.value })} /></Field><Field label="বিস্তারিত বিবরণ"><textarea lang="bn" rows={5} value={form.bnDescription} onChange={(event) => setForm({ ...form, bnDescription: event.target.value })} /></Field><div className="admin-form-grid"><Field label="বাংলা SEO title"><input lang="bn" maxLength={70} value={form.bnSeoTitle} onChange={(event) => setForm({ ...form, bnSeoTitle: event.target.value })} /></Field><Field label="বাংলা SEO description"><textarea lang="bn" rows={2} maxLength={170} value={form.bnSeoDescription} onChange={(event) => setForm({ ...form, bnSeoDescription: event.target.value })} /></Field></div></fieldset>
      <fieldset><legend>{text("Colors and sizes")}</legend><Field label={text("Sizes (comma separated)")}><input value={sizes} onChange={(event) => setSizes(event.target.value)} /></Field>{colors.map((color, index) => <div className="admin-color-row" key={index}><Field label={text("Color name")}><input value={color.name} onChange={(event) => setColors((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, name: event.target.value } : row))} /></Field><Field label={text("Swatch hex")}><input type="color" value={color.code} onChange={(event) => setColors((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, code: event.target.value } : row))} /></Field><Field label={text("Color images (URL per line)")}><textarea rows={2} value={color.images} onChange={(event) => setColors((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, images: event.target.value } : row))} /></Field><button type="button" className="account-text-button" onClick={() => setColors((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>{text("Remove color")}</button></div>)}<div className="admin-matrix-actions"><Button type="button" variant="secondary" onClick={() => setColors((rows) => [...rows, { name: '', code: '#222222', images: '' }])}>{text("Add color")}</Button><Button type="button" variant="secondary" onClick={buildMatrix}>{text("Build size and color combinations")}</Button><span>{matrixKeys.length} {text("variants")}</span></div>{variants.length > 0 && <div className="admin-variant-table"><ResponsiveTable><thead><tr><th>{text("Color")}</th><th>{text("Size")}</th><th>{text("SKU")}</th><th>{text("Price")}</th><th>{text("Compare at")}</th><th>{text("Stock")}</th><th>{text("Active")}</th></tr></thead><tbody>{variants.map((variant, index) => <tr key={`${variant.color}-${variant.size}`}><td>{variant.color}</td><td>{variant.size}</td><td><input value={variant.sku} onChange={(event) => patchVariant(index, { sku: event.target.value })} /></td><td><input type="number" min="0" step=".01" value={variant.price} onChange={(event) => patchVariant(index, { price: event.target.value })} /></td><td><input type="number" min="0" step=".01" value={variant.compareAtPrice} onChange={(event) => patchVariant(index, { compareAtPrice: event.target.value })} /></td><td><input type="number" min="0" step="1" value={variant.stock} onChange={(event) => patchVariant(index, { stock: event.target.value })} /></td><td><input type="checkbox" checked={variant.isActive} onChange={(event) => patchVariant(index, { isActive: event.target.checked })} aria-label={`Active ${variant.color} ${variant.size}`} /></td></tr>)}</tbody></ResponsiveTable></div>}</fieldset>
      <fieldset><legend>{text("Media and search")}</legend><Field label={text("Upload product images (optimized automatically)")}><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={saving} onChange={(event) => { void uploadProductImages(event.target.files); event.currentTarget.value = '' }} /></Field><a href="/admin/media">{text("Open media library")}</a><Field label={text("Product image URLs (one per line)")}><textarea rows={3} value={form.imageUrls} onChange={(event) => setForm({ ...form, imageUrls: event.target.value })} /></Field><Field label={text("Product video URLs (one per line)")}><textarea rows={2} value={form.videoUrls} onChange={(event) => setForm({ ...form, videoUrls: event.target.value })} /></Field><div className="admin-form-grid"><Field label={text("SEO title")}><input maxLength={70} value={form.seoTitle} onChange={(event) => setForm({ ...form, seoTitle: event.target.value })} /></Field><Field label={text("Canonical URL")}><input type="url" value={form.canonicalUrl} onChange={(event) => setForm({ ...form, canonicalUrl: event.target.value })} /></Field></div><Field label={text("SEO description")}><textarea rows={2} maxLength={170} value={form.seoDescription} onChange={(event) => setForm({ ...form, seoDescription: event.target.value })} /></Field></fieldset>
      <footer className="admin-editor__actions"><Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>{text("Cancel")}</Button><Button disabled={saving}>{saving ? text("Saving…") : editingId ? text("Save product") : text("Create product")}</Button></footer>
    </form></Modal>
    <footer className="account-footer"><span>© {new Date().getFullYear()} {businessConfig.name}</span><span>{text("Product catalog management")}</span></footer>
  </div>

  function patchVariant(index: number, changes: Partial<VariantDraft>) { setVariants((rows) => rows.map((variant, rowIndex) => rowIndex === index ? { ...variant, ...changes } : variant)) }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { const text=useInterfaceText();return <label className="admin-field"><span>{text(label)}</span>{children}</label> }
function toMinor(value: string) { const number = Number(value); if (!Number.isFinite(number) || number < 0 || Math.round(number * 100) !== number * 100) throw new Error('Enter a valid amount with no more than two decimal places.'); return Math.round(number * 100) }
function money(minor: number, currency = 'USD') { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100) }
