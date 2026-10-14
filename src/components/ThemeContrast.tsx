import { useInterfaceText } from '../i18n/interface-text'
export function contrastRatio(foreground:string,background:string) {
 const luminance=(hex:string)=>{const value=hex.replace('#','');const expanded=value.length===3?value.split('').map(c=>c+c).join(''):value;if(!/^[a-f\d]{6}$/i.test(expanded))return NaN;const rgb=[0,2,4].map(i=>{const n=parseInt(expanded.slice(i,i+2),16)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]}
 const a=luminance(foreground),b=luminance(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)
}
export function ThemeContrast({text,surface,primary,background}:{text:string;surface:string;primary:string;background:string}) {
 const translate=useInterfaceText()
 const ratios=[[translate('Body text'),contrastRatio(text,surface)],[translate('Primary button'),contrastRatio(primary,background)]] as const
 return <section className="theme-contrast" aria-label={translate('Readability check')}><h3>{translate('Readability check')}</h3><p>{translate('Normal text needs a contrast ratio of at least 4.5:1.')}</p><div>{ratios.map(([label,ratio])=><span key={label} className={ratio>=4.5?'is-pass':'is-review'}>{label} <strong>{Number.isFinite(ratio)?`${ratio.toFixed(1)}:1`:'—'}</strong> · {translate(ratio>=4.5?'Pass':'Review colors')}</span>)}</div></section>
}
