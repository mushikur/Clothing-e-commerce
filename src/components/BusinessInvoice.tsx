import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/I18nProvider'
import { Icon } from './Icon'
import { contrastRatio } from './ThemeContrast'
import './invoice.css'

export type InvoiceBrand = { name:string; logoUrl?:string; email?:string; phone?:string; address?:string; primary?:string; accent?:string }
export type InvoiceLine = { name:string; sku?:string; variant?:string; quantity:number; unitPrice:number; total:number; discount?:number }
export type InvoiceDetails = { number?:string; title?:string; status?:string; date?:string; currency:string; customer:{ name:string; email?:string; phone?:string }; address?:string; billingAddress?:string; payment?:string; paymentStatus?:string; delivery?:string; courier?:string; trackingNumber?:string; notes?:string; lines:InvoiceLine[]; subtotal:number; discount:number; shipping:number; tax?:number; total:number }
export function formatInvoiceAddress(parts:Array<string | undefined>) {
 const result:string[] = []
 for (const part of parts.map(item=>item?.trim()).filter((item):item is string=>Boolean(item))) {
  const normalized=part.toLocaleLowerCase().replace(/[.,\s]+/g,' ').trim()
  if (!result.some(existing=>{const previous=existing.toLocaleLowerCase().replace(/[.,\s]+/g,' ').trim();return previous===normalized || previous.includes(normalized) || normalized.includes(previous)})) result.push(part)
 }
 return result.join(', ')
}
export function InvoicePrintButton({invoice,brand,label,locale='en'}:{invoice:InvoiceDetails;brand:InvoiceBrand;label?:string;locale?:string}) {
 const {t}=useI18n();const [open,setOpen]=useState(false);const [printing,setPrinting]=useState(false);const [error,setError]=useState('')
 const titleId=useId();const dialogRef=useRef<HTMLElement>(null);const closeRef=useRef<HTMLButtonElement>(null)
 useEffect(()=>{
  if (!open) return
  const previous=document.activeElement as HTMLElement|null;const root=document.getElementById('root');const previousInert=root?.inert??false
  if(root)root.inert=true
  document.body.classList.add('invoice-active','has-overlay');closeRef.current?.focus()
  const keydown=(event:KeyboardEvent)=>{
   if(event.key==='Escape')setOpen(false)
   if(event.key!=='Tab')return
   const controls=[...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')||[])];const first=controls[0],last=controls.at(-1)
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  }
  window.addEventListener('keydown',keydown)
  return()=>{window.removeEventListener('keydown',keydown);document.body.classList.remove('invoice-active','has-overlay');if(root)root.inert=previousInert;previous?.focus()}
 },[open])
 const print=async()=>{
  setPrinting(true);setError('')
  try {
   await Promise.race([Promise.all([document.fonts.ready,...[...(dialogRef.current?.querySelectorAll('img')||[])].map(image=>image.decode().catch(()=>undefined))]),new Promise(resolve=>window.setTimeout(resolve,2500))])
   window.print()
  }catch{setError(t('invoiceUI.printError'))}finally{setPrinting(false)}
 }
 const primary=brand.primary&&contrastRatio(brand.primary,'#ffffff')>=4.5?brand.primary:'#173e39'
 const colors={'--invoice-primary':primary,'--invoice-accent':brand.accent||'#b46d47'} as CSSProperties
 return <><button type="button" className="invoice-trigger" onClick={()=>setOpen(true)}><Icon name="document"/>{label||t('invoiceUI.print')}</button>{open&&createPortal(<div className="invoice-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}><section ref={dialogRef} className="invoice-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} style={colors}><header className="invoice-dialog__toolbar"><div><p className="invoice-kicker">{t('invoiceUI.preview')}</p><h2 id={titleId}>{invoice.number||t('invoiceUI.estimate')}</h2><p>{t('invoiceUI.printHelp')}</p></div><div><button type="button" className="invoice-print" disabled={printing} aria-busy={printing} onClick={()=>void print()}>{t(printing?'invoiceUI.preparing':'invoiceUI.print')}</button><button ref={closeRef} type="button" className="invoice-close" aria-label={t('invoiceUI.close')} onClick={()=>setOpen(false)}><Icon name="close"/></button></div></header>{error&&<p role="alert">{error}</p>}<InvoicePaper invoice={invoice} brand={brand} locale={locale}/></section></div>,document.body)}</>
}
export function InvoicePaper({invoice,brand,locale}:{invoice:InvoiceDetails;brand:InvoiceBrand;locale:string}) {
 const {t}=useI18n();const money=(value:number)=>new Intl.NumberFormat(locale==='bn'?'bn-BD':'en-BD',{style:'currency',currency:invoice.currency}).format(value/100)
 const label=(value?:string)=>{if(!value)return '';const key=`invoiceUI.${value.toLowerCase().replaceAll(' ','_')}`;return t(key)===key?value:t(key)}
 const estimate=!invoice.number||invoice.title==='Checkout estimate'
 return <article className="invoice-paper" id="invoice-print-root" lang={locale}><div className="invoice-paper__topline"/><header className="invoice-paper__header"><div className="invoice-paper__brand">{brand.logoUrl?<img src={brand.logoUrl} alt={brand.name}/>:<span className="invoice-paper__monogram">{brand.name.trim().charAt(0).toUpperCase()||'S'}</span>}<div><strong>{brand.name}</strong>{brand.address&&<span>{brand.address}</span>}{brand.email&&<span>{brand.email}</span>}{brand.phone&&<span>{brand.phone}</span>}</div></div><div className="invoice-paper__identity"><p className="invoice-kicker">{t(estimate?'invoiceUI.estimate':'invoiceUI.title')}</p><h1>{invoice.number||t('invoiceUI.estimate')}</h1><span>{t('invoiceUI.date')} · {invoice.date||new Date().toLocaleDateString(locale==='bn'?'bn-BD':'en-BD')}</span>{invoice.status&&<b>{label(invoice.status)}</b>}</div></header><section className="invoice-paper__parties"><div><p className="invoice-kicker">{t('invoiceUI.billed')}</p><strong>{invoice.customer.name||t('invoiceUI.customer')}</strong>{invoice.customer.phone&&<span>{invoice.customer.phone}</span>}{invoice.customer.email&&<span>{invoice.customer.email}</span>}{invoice.billingAddress&&<span>{invoice.billingAddress}</span>}</div><div><p className="invoice-kicker">{t('invoiceUI.shipping')}</p><span>{invoice.address||t('invoiceUI.addressPending')}</span>{invoice.delivery&&<span>{invoice.delivery}</span>}</div></section><table className="invoice-paper__table"><colgroup><col className="invoice-col-product"/><col className="invoice-col-qty"/><col className="invoice-col-price"/><col className="invoice-col-amount"/></colgroup><thead><tr>{['item','quantity','unit','amount'].map(key=><th key={key} scope="col">{t(`invoiceUI.${key}`)}</th>)}</tr></thead><tbody>{invoice.lines.map((line,index)=><tr key={`${line.sku||line.name}-${index}`}><td><strong>{line.name}</strong><small>{[line.variant,line.sku].filter(Boolean).join(' · ')}</small>{Boolean(line.discount)&&<small>{t('invoiceUI.discount')} −{money(line.discount!)}</small>}</td><td>{line.quantity}</td><td>{money(line.unitPrice)}</td><td><strong>{money(line.total)}</strong></td></tr>)}</tbody></table><footer className="invoice-paper__footer"><div className="invoice-paper__note"><p className="invoice-kicker">{t('invoiceUI.payment')}</p><p>{[label(invoice.payment),label(invoice.paymentStatus)].filter(Boolean).join(' · ')||'—'}</p>{invoice.courier&&<p>{t('invoiceUI.courier')} · {invoice.courier}</p>}{invoice.trackingNumber&&<p>{t('invoiceUI.tracking')} · {invoice.trackingNumber}</p>}{invoice.notes&&<p><strong>{t('invoiceUI.notes')}</strong><br/>{invoice.notes}</p>}{estimate&&<p className="invoice-estimate-note">{t('invoiceUI.estimateNote')}</p>}</div><div className="invoice-paper__totals"><div><span>{t('invoiceUI.subtotal')}</span><strong>{money(invoice.subtotal)}</strong></div>{invoice.discount>0&&<div><span>{t('invoiceUI.discount')}</span><strong>−{money(invoice.discount)}</strong></div>}<div><span>{t('invoiceUI.delivery')}</span><strong>{money(invoice.shipping)}</strong></div>{(invoice.tax||0)>0&&<div><span>{t('invoiceUI.tax')}</span><strong>{money(invoice.tax||0)}</strong></div>}<div className="invoice-paper__grand"><span>{t('invoiceUI.total')}</span><strong>{money(invoice.total)}</strong></div></div></footer><div className="invoice-paper__bottom"><strong>{t('invoiceUI.thanks',{name:brand.name})}</strong><span>{t('invoiceUI.footer')}</span></div></article>
}
