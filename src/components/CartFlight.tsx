import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { safeWebUrl } from '../lib/safe-url'

export type CartFlightDetails={image:string;origin:{x:number;y:number}}
export function CartFlight() {
 const [flight,setFlight]=useState<(CartFlightDetails&{dx:number;dy:number;id:number})|null>(null)
 useEffect(()=>{
  let timer:number|undefined
  const added=(event:Event)=>{
   if(window.matchMedia('(prefers-reduced-motion:reduce)').matches||document.documentElement.dataset.reducedMotion==='true')return
   const detail=(event as CustomEvent<CartFlightDetails>).detail
   const target=[...document.querySelectorAll<HTMLElement>('[data-cart-target]')].find(element=>element.getBoundingClientRect().width>0)
   if(!detail?.origin||!safeWebUrl(detail.image)||!target)return
   const rect=target.getBoundingClientRect()
   setFlight({...detail,dx:rect.left+rect.width/2-detail.origin.x,dy:rect.top+rect.height/2-detail.origin.y,id:Date.now()})
   if(timer)window.clearTimeout(timer)
   timer=window.setTimeout(()=>setFlight(null),420)
  }
  window.addEventListener('fashion-cart-flight',added)
  return()=>{window.removeEventListener('fashion-cart-flight',added);if(timer)window.clearTimeout(timer)}
 },[])
 if(!flight)return null
 return createPortal(<img key={flight.id} className="cart-flight" alt="" aria-hidden="true" src={safeWebUrl(flight.image)} style={{left:flight.origin.x-28,top:flight.origin.y-36,'--flight-x':`${flight.dx}px`,'--flight-y':`${flight.dy}px`} as CSSProperties}/>,document.body)
}
