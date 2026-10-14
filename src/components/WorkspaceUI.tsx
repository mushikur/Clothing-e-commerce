import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode, type TableHTMLAttributes } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { Icon } from './Icon'
import { interfaceText } from '../i18n/interface-text'

type NodeProps = { children?:ReactNode; colSpan?:number; className?:string; 'data-label'?:string; role?:string }
function textContent(node:ReactNode):string { return Children.toArray(node).map(child=>typeof child==='string'||typeof child==='number'?String(child):isValidElement<NodeProps>(child)?textContent(child.props.children):'').join(' ').trim() }

/** The same semantic table becomes labeled record cards at mobile widths. */
export function ResponsiveTable({children,className='',...props}:TableHTMLAttributes<HTMLTableElement>) {
 const {locale}=useI18n()
 const groups=Children.toArray(children)
 const head=groups.find(child=>isValidElement(child)&&child.type==='thead') as ReactElement<NodeProps>|undefined
 const headRow=Children.toArray(head?.props.children).find(child=>isValidElement(child)&&child.type==='tr') as ReactElement<NodeProps>|undefined
 const labels=Children.toArray(headRow?.props.children).map(child=>interfaceText(textContent(child),locale))
 const rows=(nodes:ReactNode):ReactNode=>Children.map(nodes,node=>{
  if(!isValidElement<NodeProps>(node))return node
  if(node.type==='tr')return cloneElement(node,{role:'row',children:Children.map(node.props.children,(cell,index)=>isValidElement<NodeProps>(cell)?cloneElement(cell,{role:'cell','data-label':cell.props.colSpan?undefined:labels[index]}):cell)})
  return node
 })
 return <table {...props} className={`responsive-table ${className}`} role="table">{groups.map((group,index)=>isValidElement<NodeProps>(group)&&group.type==='tbody'?cloneElement(group,{key:group.key??index,role:'rowgroup',children:rows(group.props.children)}):group)}</table>
}
export function WorkspaceSkeleton({kind='table'}:{kind?:'table'|'dashboard'|'form'}) {
 const {t}=useI18n()
 return <div className={`workspace-skeleton workspace-skeleton--${kind}`} role="status" aria-label={t('common.loading')} aria-busy="true"><span className="sr-only">{t('common.loading')}</span><div className="workspace-skeleton__heading skeleton"/>{kind==='dashboard'&&<div className="workspace-skeleton__metrics">{Array.from({length:4},(_,i)=><div className="skeleton" key={i}/>)}</div>}<div className="workspace-skeleton__rows">{Array.from({length:kind==='form'?4:6},(_,i)=><div className="skeleton" key={i}/>)}</div></div>
}
export function StatusBadge({status}:{status:string}) {
 const {locale}=useI18n()
 const tone=['active','delivered','captured','approved','published','completed','verified'].includes(status)?'success':['cancelled','failed','rejected','disabled','error'].includes(status)?'error':['pending','low','requires_action','draft','requested','processing'].includes(status)?'warning':'neutral'
 const label=interfaceText(status.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase()),locale)
 return <span className={`status-badge status-badge--${tone}`}><i aria-hidden="true"/>{label}</span>
}
export function WorkspaceEmpty({title,detail,action}:{title:string;detail?:string;action?:ReactNode}) {
 return <div className="workspace-empty"><span><Icon name="box"/></span><h3>{title}</h3>{detail&&<p>{detail}</p>}{action}</div>
}
export function MetricValue({value}:{value:string}) { const parts=value.match(/^([A-Z]{3}|[^\d\s০-৯]{1,3})\s*([\d০-৯,.-]+)$/);return parts?<><span className="metric-currency">{parts[1]} </span><span className="metric-number">{parts[2]}</span></>:<span className="metric-number">{value}</span> }
