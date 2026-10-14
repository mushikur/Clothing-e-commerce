import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { installAccessToken } from '../../lib/session'
import { managementRequest } from './AdminManagement'
import { managementError, useAdminText } from '../../i18n/admin-management'
export default function AdminAccountSettings() {
  const text=useAdminText()
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('')
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('')
  useEffect(()=>{let alive=true;managementRequest('/auth/me').then(result=>{if(alive){setName(result.data.user.name);setEmail(result.data.user.email)}}).catch(()=>{if(alive)setError(text('loadError'))}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[])
  async function saveName(event:FormEvent) {
    event.preventDefault();setBusy('name');setError('');setMessage('')
    try {const result=await managementRequest('/users/me','PATCH',{name:name.trim()});setName(result.data.user.name);window.dispatchEvent(new CustomEvent('admin-profile-updated',{detail:{name:result.data.user.name}}));setMessage(text('nameSaved'))}
    catch(cause){const issue=cause as Error&{code?:string};setError(managementError(issue.code,issue.message,text))}finally{setBusy('')}
  }
  async function savePassword(event:FormEvent) {
    event.preventDefault();setError('');setMessage('')
    if(password!==confirmation){setError(text('mismatch'));return}
    if(password.length<12||new TextEncoder().encode(password).length>72){setError(text('passwordLength'));return}
    setBusy('password')
    try{const result=await managementRequest('/auth/change-password','POST',{currentPassword:current,newPassword:password});installAccessToken(result.data.accessToken);setCurrent('');setPassword('');setConfirmation('');setMessage(text('passwordSaved'))}
    catch(cause){const issue=cause as Error&{code?:string};setError(managementError(issue.code,issue.message,text))}finally{setBusy('')}
  }
  return <section className="admin-management-panel" aria-labelledby="admin-account-title"><h2 id="admin-account-title">{text('account')}</h2><p>{text('accountHelp')}</p>{error&&<p role="alert" className="admin-management-error">{error}</p>}{message&&<p role="status">{message}</p>}
    <div className="admin-account-grid"><form onSubmit={saveName}><label>{text('name')}<input required maxLength={100} autoComplete="name" value={name} disabled={loading||Boolean(busy)} onChange={event=>setName(event.target.value)}/></label><label>{text('email')}<input type="email" value={email} readOnly autoComplete="username"/></label><Button type="submit" disabled={loading||Boolean(busy)||!name.trim()}>{text('saveName')}</Button></form>
    <form onSubmit={savePassword}><h3>{text('password')}</h3><p>{text('passwordHelp')}</p><label>{text('current')}<input type="password" required autoComplete="current-password" value={current} onChange={event=>setCurrent(event.target.value)} disabled={Boolean(busy)}/></label><label>{text('next')}<input type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} disabled={Boolean(busy)}/></label><label>{text('confirm')}<input type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)} disabled={Boolean(busy)}/></label><Button type="submit" disabled={loading||Boolean(busy)}>{text('passwordSave')}</Button></form></div>
  </section>
}
