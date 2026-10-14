import { createContext, useContext, useEffect, useState } from 'react'
import { Button, Modal } from '../../components/ui'
import { ResponsiveTable, WorkspaceSkeleton } from '../../components/WorkspaceUI'
import { fetchWithSession, getAccessToken } from '../../lib/session'
import { useAdminText, managementError } from '../../i18n/admin-management'
import { useI18n } from '../../i18n/I18nProvider'
import './admin-management.css'

export const AdminManagementAccess = createContext(false)
type Kind = 'order' | 'customer' | 'product'
const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
export async function managementRequest(path:string, method='GET', body?:unknown) {
  const token = await getAccessToken()
  const headers = new Headers({Authorization:`Bearer ${token || ''}`})
  if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug',import.meta.env.VITE_BUSINESS_SLUG)
  if (body) headers.set('Content-Type','application/json')
  const response = await fetchWithSession(`${apiBase}${path}`, {method, headers, credentials:'include', ...(body ? {body:JSON.stringify(body)} : {})})
  const result = await response.json()
  if (!response.ok || !result.success) throw Object.assign(new Error(result.error?.message),{code:result.error?.code})
  return result
}
export function DeleteRecordButton({kind, recordKey, name, onDeleted}: {kind:Kind;recordKey:string;name:string;onDeleted:()=>void}) {
  const allowed = useContext(AdminManagementAccess)
  const text = useAdminText()
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
  if (!allowed) return null
  async function remove() {
    setBusy(true);setError('')
    try { await managementRequest(`/admin/trash/${kind}/${encodeURIComponent(recordKey)}`,'DELETE');setOpen(false);onDeleted() }
    catch(cause) {const issue=cause as Error & {code?:string};setError(managementError(issue.code,issue.message,text))}
    finally {setBusy(false)}
  }
  return <><button type="button" className="admin-delete-action" aria-label={`${text('delete')} ${name}`} onClick={()=>{setError('');setOpen(true)}}>{text('delete')}</button>
    <Modal open={open} onClose={()=>{if(!busy)setOpen(false)}} title={text('title')}><div className="admin-delete-dialog"><strong>{name}</strong><p>{text('deleteHelp')}</p>{kind!=='order'&&<p>{text(kind==='customer'?'customerHelp':'productHelp')}</p>}{error&&<p role="alert" className="admin-management-error">{error}</p>}<div className="admin-management-actions"><Button variant="secondary" disabled={busy} onClick={()=>setOpen(false)}>{text('cancel')}</Button><Button disabled={busy} onClick={()=>void remove()}>{text(busy?'deleting':'delete')}</Button></div></div></Modal></>
}
export default function AdminTrash() {
  const allowed=useContext(AdminManagementAccess),text=useAdminText(),{locale}=useI18n()
  const [kind,setKind]=useState<Kind>('order'),[page,setPage]=useState(1),[pages,setPages]=useState(1),[items,setItems]=useState<Array<{key:string;name:string;deletedAt:string}>>([])
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[reload,setReload]=useState(0)
  useEffect(()=>{
    if(!allowed){setLoading(false);return}
    let alive=true;setLoading(true);setError('')
    managementRequest(`/admin/trash?kind=${kind}&page=${page}&limit=20`).then(result=>{if(alive){setItems(result.data.items);setPages(Math.max(1,result.meta?.pages||1));if(!result.data.items.length&&page>1)setPage(page-1)}}).catch(()=>{if(alive)setError(text('loadError'))}).finally(()=>{if(alive)setLoading(false)})
    return()=>{alive=false}
  },[allowed,kind,page,reload,locale])
  async function restore(key:string) {
    setBusy(key);setError('');setMessage('')
    try{await managementRequest(`/admin/trash/${kind}/${encodeURIComponent(key)}/restore`,'POST');setReload(value=>value+1);setMessage(text('restored'))}
    catch(cause){const issue=cause as Error & {code?:string};setError(managementError(issue.code,issue.message,text))}
    finally{setBusy('')}
  }
  if(!allowed)return <p role="alert">{text('denied')}</p>
  return <section className="admin-management-panel"><h2>{text('trash')}</h2><p>{text('trashHelp')}</p><div className="admin-management-actions" role="group" aria-label={text('trash')}>{(['order','customer','product'] as Kind[]).map(option=><Button key={option} variant={kind===option?'primary':'secondary'} aria-pressed={kind===option} onClick={()=>{setKind(option);setPage(1);setMessage('')}}>{text(option==='order'?'orders':option==='customer'?'customers':'products')}</Button>)}</div>
    {message&&<p role="status">{message}</p>}{error&&<div role="alert"><p>{error}</p><Button variant="secondary" onClick={()=>setReload(value=>value+1)}>{text('retry')}</Button></div>}
    {loading?<WorkspaceSkeleton/>:items.length?<ResponsiveTable><thead><tr><th>{text('record')}</th><th>{text('deleted')}</th><th>{text('actions')}</th></tr></thead><tbody>{items.map(item=><tr key={item.key}><td>{item.name}</td><td>{new Date(item.deletedAt).toLocaleDateString(locale==='bn'?'bn-BD':'en-BD')}</td><td><Button variant="secondary" disabled={Boolean(busy)} onClick={()=>void restore(item.key)}>{text('restore')}</Button></td></tr>)}</tbody></ResponsiveTable>:<p className="admin-empty">{text('empty')}</p>}
    {pages>1&&<div className="admin-management-actions"><Button variant="secondary" disabled={page===1||loading} onClick={()=>setPage(page-1)}>{text('previous')}</Button><span>{page} / {pages}</span><Button variant="secondary" disabled={page===pages||loading} onClick={()=>setPage(page+1)}>{text('nextPage')}</Button></div>}
  </section>
}
