import { useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import './wallet-instructions.css'

export type CollectionDetails = { merchantNumber?: string; accountType?: string; instructions?: string }
export function WalletInstructions({ provider, details, amount, confirmed = false, reference, demo = false }: { provider: 'bkash' | 'nagad'; details?: CollectionDetails; amount?: string; confirmed?: boolean; reference?: string; demo?: boolean }) {
  const {t}=useI18n(), [copyState,setCopyState]=useState('')
  const name=provider==='bkash'?'bKash':'Nagad', code=provider==='bkash'?'*247#':'*167#'
  const merchant=details?.accountType?.toLowerCase()==='merchant', operation=t(`guides.${merchant?'payment':'sendMoney'}`)
  const simulated=demo||Boolean(details?.instructions?.toLowerCase().includes('simulated demo'))
  async function copy() { try { await navigator.clipboard.writeText(details?.merchantNumber||'');setCopyState(t('guides.copied')) } catch {setCopyState(t('guides.copyFailed'))} }
  return <section className={`wallet-guide wallet-guide--${provider}`} aria-label={t('guides.walletTitle',{provider:name,operation})}>
    <header><span className="wallet-guide__mark" aria-hidden="true">{provider==='bkash'?'b':'ন'}</span><div><h3>{t('guides.walletTitle',{provider:name,operation})}</h3><p>{t(`guides.${merchant?'merchant':'personal'}`)}</p></div></header>
    {simulated&&<p className="wallet-guide__notice" role="note">{t('guides.demo')}</p>}
    <div className="wallet-guide__recipient"><div><span>{t('guides.number')}</span>{details?.merchantNumber?<strong dir="ltr">{details.merchantNumber}</strong>:<p>{t('guides.unavailable')}</p>}</div>{details?.merchantNumber&&<button type="button" onClick={()=>void copy()}>{t('guides.copy')}</button>}</div>
    {copyState&&<small role="status">{copyState}</small>}
    <div className="wallet-guide__amount"><span>{t(`guides.${confirmed?'amount':'estimate'}`)}</span><strong>{amount||t('guides.pending')}</strong></div>
    {!confirmed&&<p className="wallet-guide__notice">{t('guides.before')}</p>}
    {reference&&<p>{t('guides.reference')}: <strong dir="ltr">{reference}</strong></p>}
    <details open><summary>{t('guides.app')}</summary><ol><li>{t('guides.appStep',{provider:name,operation})}</li><li>{t('guides.recipientStep',{number:details?.merchantNumber||'…'})}</li><li>{t('guides.amountStep')}</li><li>{t('guides.confirmStep')}</li></ol></details>
    <details><summary>{t('guides.dial')} <b dir="ltr">{code}</b></summary><ol><li>{t('guides.dialStep',{provider:name,code,operation})}</li><li>{t('guides.recipientStep',{number:details?.merchantNumber||'…'})}</li><li>{t('guides.dialConfirm')}</li></ol></details>
    {!simulated&&details?.instructions&&<div className="wallet-guide__custom"><strong>{t('guides.extra')}</strong><p>{details.instructions}</p></div>}
    <p>{t('guides.receipt')}</p><small className="wallet-guide__security">{t('guides.private')}</small>
  </section>
}
