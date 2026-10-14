import { fetchWithSession } from '../../lib/session'
import { useEffect, useRef, useState } from 'react'
import { ProductGrid, type Product, type ProductVariant } from '../../components/commerce'
import { ExperienceSkeleton } from '../../components/Experience'
import { Toast } from '../../components/ui'
import { useI18n } from '../../i18n/I18nProvider'
import { addToBag } from '../../lib/shopping'
import { getAccessToken } from '../../lib/session'
import { mapProduct, type RawProduct } from './ProductCatalog'

const apiBase=`${(import.meta.env.VITE_API_URL||'http://localhost:4000').replace(/\/$/,'')}/api/v1`
export default function RelatedProducts({categoryId,excludeId}:{categoryId?:string;excludeId:string}) {
 const {locale,t}=useI18n();const ref=useRef<HTMLElement>(null);const [visible,setVisible]=useState(false),[products,setProducts]=useState<Product[]>([]),[loading,setLoading]=useState(true),[wished,setWished]=useState<string[]>([]),[notice,setNotice]=useState(''),[error,setError]=useState('')
 useEffect(()=>{if(!ref.current)return;if(!('IntersectionObserver' in window)){setVisible(true);return}const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setVisible(true);observer.disconnect()}},{rootMargin:'300px'});observer.observe(ref.current);return()=>observer.disconnect()},[])
 useEffect(()=>{
  if(!visible)return
  const controller=new AbortController();const headers=new Headers();if(import.meta.env.VITE_BUSINESS_SLUG)headers.set('X-Business-Slug',import.meta.env.VITE_BUSINESS_SLUG)
  setLoading(true)
  fetchWithSession(`${apiBase}/products?${new URLSearchParams({limit:'5',...(categoryId?{categoryId}:{})})}`,{headers,signal:controller.signal,credentials:'include'}).then(async response=>{if(!response.ok)throw new Error();const result=await response.json();if(!controller.signal.aborted)setProducts((result.data as RawProduct[]||[]).filter(product=>product._id!==excludeId).slice(0,4).map(product=>mapProduct(product,locale)))}).catch(()=>{if(!controller.signal.aborted)setProducts([])}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  void getAccessToken().then(async token=>{if(!token)return;headers.set('Authorization',`Bearer ${token}`);const response=await fetchWithSession(`${apiBase}/users/me/wishlist`,{headers,signal:controller.signal,credentials:'include'});if(response.ok){const result=await response.json();if(!controller.signal.aborted)setWished(result.data.products.map((product:{_id:string})=>product._id))}}).catch(()=>undefined)
  return()=>controller.abort()
 },[visible,categoryId,excludeId,locale])
 const add=async(product:Product,variant?:ProductVariant,buyNow=false)=>{setError('');if(!variant)return;if(buyNow){window.location.assign(`/checkout?buyNow=${encodeURIComponent(variant.id)}`);return}try{await addToBag(product,variant);setNotice(t('product.added'))}catch{setError(t('cart.networkError'))}}
 const wish=async(product:Product)=>{setError('');const token=await getAccessToken();if(!token){setError(t('product.signInToSave'));return}const headers=new Headers({Authorization:`Bearer ${token}`});if(import.meta.env.VITE_BUSINESS_SLUG)headers.set('X-Business-Slug',import.meta.env.VITE_BUSINESS_SLUG);const active=wished.includes(product.id);try{const response=await fetchWithSession(`${apiBase}/users/me/wishlist/${product.id}`,{method:active?'DELETE':'POST',headers,credentials:'include'});if(!response.ok)throw new Error();const next=active?wished.filter(id=>id!==product.id):[...wished,product.id];setWished(next);window.dispatchEvent(new CustomEvent('storefront-wishlist-count',{detail:{count:next.length}}));setNotice(t(active?'product.removedFromWishlist':'product.savedToWishlist'))}catch{setError(t('product.unavailable'))}}
 if(visible&&!loading&&!products.length)return null
 return <section ref={ref} className="related-products"><header><p className="eyebrow">{t('catalog.collection')}</p><h2>{t('product.related')}</h2></header>{error&&<p role="alert" className="catalog-feedback catalog-feedback--error">{error} <a href="/account/sign-in">{t('account.signIn')}</a></p>}{loading?<ExperienceSkeleton/>:<ProductGrid products={products} wished={wished} onAdd={(product,variant)=>void add(product,variant)} onBuyNow={(product,variant)=>void add(product,variant,true)} onWishlist={product=>void wish(product)}/>}<Toast open={Boolean(notice)} message={notice} onClose={()=>setNotice('')}/></section>
}
