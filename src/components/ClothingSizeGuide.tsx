import { useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { Modal } from './ui'
import { adultCharts, childCharts, clothingTypes, suggestedClothing, type ClothingType, type SizeRange } from './size-guide-data'
import './clothing-size-guide.css'

export type ClothingSizeGuideProps = { open:boolean; onClose:()=>void; category?:string; gender?:string }
export default function ClothingSizeGuide({open,onClose,category='',gender='men'}:ClothingSizeGuideProps) {
  const {t,locale}=useI18n(),[clothing,setClothing]=useState<ClothingType>(()=>suggestedClothing(category)),[range,setRange]=useState<SizeRange>(gender==='women'?'women':gender==='kids'?'kids':'men'),[unit,setUnit]=useState<'inches'|'cm'>('inches')
  const children=range==='kids'||range==='baby',rows=children?childCharts[range as 'kids'|'baby']:adultCharts[range as 'men'|'women']
  const number=new Intl.NumberFormat(locale==='bn'?'bn-BD':'en-BD',{maximumFractionDigits:1})
  const measurement=(values:readonly[number,number],source:'inches'|'cm')=>values.map(value=>number.format(source===unit?value:source==='inches'?value*2.54:value/2.54)).join('–')
  const notes=clothing==='shirts'?'shirtsHelp':['trousers','shorts'].includes(clothing)?'bottomsHelp':['panjabi','salwar'].includes(clothing)?'longHelp':clothing==='dresses'?'dressHelp':clothing==='saree'?'sareeHelp':clothing==='underwear'?'underwearHelp':['jacket','hoodie','knit'].includes(clothing)?'layerHelp':'fitHelp'
  return <Modal open={open} onClose={onClose} title={t('guides.title')} className="clothing-size-guide"><p className="clothing-size-guide__intro">{t('guides.intro')}</p><p className="clothing-size-guide__notice">{t('guides.referenceNote')}</p>
    <div className="clothing-size-guide__controls"><label>{t('guides.clothing')}<select value={clothing} onChange={event=>setClothing(event.target.value as ClothingType)}>{clothingTypes.map(type=><option key={type} value={type}>{t(`guides.${type}`)}</option>)}</select></label><label>{t('guides.fit')}<select value={range} onChange={event=>setRange(event.target.value as SizeRange)}>{(['men','women','kids','baby'] as const).map(type=><option key={type} value={type}>{t(`guides.${type}`)}</option>)}</select></label><div><span>{t('guides.unit')}</span><div className="clothing-size-guide__units" role="group" aria-label={t('guides.unit')}>{(['inches','cm'] as const).map(option=><button type="button" key={option} aria-pressed={unit===option} onClick={()=>setUnit(option)}>{t(`guides.${option}`)}</button>)}</div></div></div>
    <p className="clothing-size-guide__tip">{t(`guides.${notes}`)}</p>
    <div className="clothing-size-guide__table" tabIndex={0} role="region" aria-label={t('guides.body')}><table><caption>{t('guides.body')} · {t(`guides.${unit}`)}</caption><thead><tr><th scope="col">{t('guides.size')}</th>{(children?['height','age']:['chest','waist','hip']).map(key=><th scope="col" key={key}>{t(`guides.${key}`)}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.size}><th scope="row">{row.size}</th>{children?<><td>{measurement(row.height!,'cm')}</td><td>{row.months!.map(value=>number.format(range==='baby'?value:value/12)).join('–')} {t(range==='baby'?'guides.months':'guides.years')}</td></>:<><td>{measurement(row.chest!,'inches')}</td><td>{measurement(row.waist!,'inches')}</td><td>{measurement(row.hip!,'inches')}</td></>}</tr>)}</tbody></table></div>
    <details open className="clothing-size-guide__measure"><summary>{t('guides.measureTitle')}</summary><ul>{['chestHelp','waistHelp','hipHelp',children?'heightHelp':'lengthHelp'].map(key=><li key={key}>{t(`guides.${key}`)}</li>)}</ul></details><p>{t('guides.fitHelp')}</p><a className="link-arrow" href="/contact">{t('guides.contact')} ↗</a>
  </Modal>
}
