import { fetchWithSession } from '../../lib/session'
import { useEffect, useState } from 'react'
import { getAccessToken } from '../../lib/session'
import { getGuestCart } from '../../lib/guest-cart'
import { ExperienceSkeleton } from '../../components/Experience'
import { useI18n } from '../../i18n/I18nProvider'
import { safeWebUrl } from '../../lib/safe-url'
const apiBase=`${(import.meta.env.VITE_API_URL||'http://localhost:4000').replace(/\/$/,'')}/api/v1`
type Line={variantId:string;name:string;nameTranslations?:{en?:string;bn?:string};slug:string;color:string;size:string;image?:string;quantity:number;price:number;currency:string}
export default function MiniCartContents({revision}:{revision:number}) {
 const {locale,t}=useI18n();const [items,setItems]=useState<Line[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('')
  void (async()=>{
   const token=await getAccessToken();const headers=new Headers();if(import.meta.env.VITE_BUSINESS_SLUG)headers.set('X-Business-Slug',import.meta.env.VITE_BUSINESS_SLUG);if(token)headers.set('Authorization',`Bearer ${token}`)
   const lines=getGuestCart();if(!token&&!lines.length){setItems([]);return}
   if(!token)headers.set('Content-Type','application/json')
   const response=await fetchWithSession(`${apiBase}${token?'/cart':'/checkout/quote'}`,{method:token?'GET':'POST',headers,credentials:'include',signal:controller.signal,...(!token?{body:JSON.stringify({items:lines})}:{})})
   if(!response.ok)throw new Error();const result=await response.json();if(!result.success)throw new Error();if(!controller.signal.aborted)setItems(result.data.items||[])
  })().catch(()=>{if(!controller.signal.aborted)setError(t('cart.networkError'))}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  return()=>controller.abort()
 },[revision,t])
 if(loading)return <ExperienceSkeleton kind="cart" count={2}/>
 if(error)return <p className="catalog-feedback catalog-feedback--error" role="alert">{error}</p>
 return <div className="mini-cart-lines">{items.map(item=><article key={item.variantId}><a href={`/products/${item.slug}`} tabIndex={-1}>{item.image&&<img src={safeWebUrl(item.image)} alt="" width={72} height={90} decoding="async"/>}</a><div><a href={`/products/${item.slug}`}>{locale === 'bn' ? item.nameTranslations?.bn || item.name : item.nameTranslations?.en || item.name}</a><span>{item.color} · {item.size} · {t('cart.quantity')} {item.quantity}</span><strong>{new Intl.NumberFormat(locale==='bn'?'bn-BD':'en-BD',{style:'currency',currency:item.currency}).format(item.price*item.quantity/100)}</strong></div></article>)}</div>
}
