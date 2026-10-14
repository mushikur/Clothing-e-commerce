import { useI18n } from '../i18n/I18nProvider'
import { Icon } from './Icon'
export function QuantityControl({value,max,disabled,onChange}:{value:number;max:number;disabled?:boolean;onChange:(value:number)=>void}) {
 const {t}=useI18n();const change=(delta:number)=>{if(!disabled&&value+delta>=1&&value+delta<=max)onChange(value+delta)}
 return <div className="quantity-control" aria-busy={disabled||undefined}><button type="button" aria-label={t('delight.decrease')} disabled={disabled||value<=1} onClick={()=>change(-1)}><Icon name="minus"/></button><span tabIndex={0} role="spinbutton" aria-label={t('delight.quantity')} aria-valuenow={value} aria-valuemin={1} aria-valuemax={max} aria-disabled={disabled} onKeyDown={event=>{if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();change(event.key==='ArrowUp'?1:-1)}}}>{value}</span><button type="button" aria-label={t('delight.increase')} disabled={disabled||value>=max} onClick={()=>change(1)}><Icon name="plus"/></button></div>
}
