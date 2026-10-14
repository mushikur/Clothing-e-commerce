import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Icon, type IconName } from './Icon'
import { useI18n } from '../i18n/I18nProvider'
import { createPortal } from 'react-dom'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'text' | 'icon'; size?: 'sm' | 'md' | 'lg'; loading?: boolean }
export function Button({ variant = 'primary', size = 'md', loading = false, className = '', children, disabled, ...props }: ButtonProps) {
  return <button className={`button button--${variant} button--${size} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading && <span className="spinner" aria-hidden="true" />}{children}
  </button>
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }
export function Input({ label, hint, error, id, className = '', ...props }: FieldProps) {
  const generated = useId(); const fieldId = id ?? generated
  return <div className="field"><label className="field__label" htmlFor={fieldId}>{label}</label><input id={fieldId} className={`control ${error ? 'control--error' : ''} ${className}`} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined} {...props} />{error ? <span className="field__error" id={`${fieldId}-error`}>{error}</span> : hint ? <span className="field__hint" id={`${fieldId}-hint`}>{hint}</span> : null}</div>
}
export function Select({ label, id, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const generated = useId(); const fieldId = id ?? generated
  return <div className="field"><label className="field__label" htmlFor={fieldId}>{label}</label><select id={fieldId} className="control control--select" {...props}>{children}</select></div>
}
export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return <label className="check-control"><input type="checkbox" {...props} /><span className="check-control__box"><Icon name="check" /></span><span>{label}</span></label>
}
export function Radio({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return <label className="radio-control"><input type="radio" {...props} /><span className="radio-control__dot" /><span>{label}</span></label>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'error' }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <div className={`card ${className}`}>{children}</div> }
export function Skeleton({ className = '' }: { className?: string }) { return <span className={`skeleton ${className}`} aria-hidden="true" /> }

export function Avatar({ name, src, size = 'md' }: { name: string; src?: string; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`avatar avatar--${size}`}>{src ? <img src={src} alt="" /> : name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
}
export function Loading({ label = 'Loading' }: { label?: string }) { return <span className="loading" role="status"><span className="spinner" aria-hidden="true" />{label}</span> }
export function EmptyState({ title, description, action, illustration }: { title: string; description: string; action?: ReactNode; illustration?: ReactNode }) { return <div className="empty-state">{illustration || <span className="empty-state__mark"><Icon name="sparkle" /></span>}<h3>{title}</h3><p>{description}</p>{action}</div> }

export function Modal({ open, onClose, title, children, className = '' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  const { t } = useI18n()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const titleId = useId(); const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prior = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    const previousInert = root?.inert ?? false
    if (root) root.inert = true
    const focusable = panelRef.current?.querySelector<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')
    focusable?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { closeRef.current(); return }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusableItems = [...panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (!focusableItems.length) { event.preventDefault(); panelRef.current.focus(); return }
      const first = focusableItems[0]
      const last = focusableItems[focusableItems.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    document.body.classList.add('has-overlay')
    return () => { document.removeEventListener('keydown', keydown); document.body.classList.remove('has-overlay'); if (root) root.inert = previousInert; prior?.focus() }
  }, [open])
  if (!open) return null
  return createPortal(<div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section ref={panelRef} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><div className="modal__head"><h2 id={titleId}>{title}</h2><Button variant="icon" aria-label={t('delight.close')} onClick={onClose}><Icon name="close" /></Button></div>{children}</section></div>, document.body)
}
export function Drawer({ open, onClose, title, children, side = 'right' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; side?: 'left' | 'right' }) {
  return <Modal open={open} onClose={onClose} title={title} className={`drawer drawer--${side}`}><div className="drawer__body">{children}</div></Modal>
}

export function Dropdown({ label, children, align = 'left' }: { label: ReactNode; children: ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  return <div className={`dropdown dropdown--${align}`} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }}><button className="dropdown__trigger" aria-expanded={open} onClick={() => setOpen(!open)}>{label}<Icon name="chevron" /></button>{open && <div className="dropdown__menu" role="menu">{children}</div>}</div>
}
export function Toast({ message, open, onClose }: { message: string; open: boolean; onClose: () => void }) {
  useEffect(() => { if (!open) return; const timer = window.setTimeout(onClose, 3000); return () => window.clearTimeout(timer) }, [open, onClose])
  return <div className={`toast ${open ? 'toast--visible' : ''}`} role="status" aria-live="polite"><span className="toast__check"><Icon name="check" /></span>{message}</div>
}
export function Tooltip({ label, children }: { label: string; children: ReactNode }) { return <span className="tooltip" tabIndex={0} aria-label={label}><span className="tooltip__content">{children}</span><span className="tooltip__bubble" role="tooltip">{label}</span></span> }

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; content: ReactNode }[]; value: string; onChange: (id: string) => void }) {
  const panelId = `${value}-panel`
  const activateByKey = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex !== undefined) { event.preventDefault(); const next = tabs[nextIndex]; onChange(next.id); document.getElementById(`${next.id}-tab`)?.focus() }
  }
  return <div className="tabs"><div className="tabs__list" role="tablist" aria-label="Product information">{tabs.map((tab, index) => <button key={tab.id} id={`${tab.id}-tab`} tabIndex={value === tab.id ? 0 : -1} className={`tabs__tab ${value === tab.id ? 'is-active' : ''}`} role="tab" aria-selected={value === tab.id} aria-controls={`${tab.id}-panel`} onClick={() => onChange(tab.id)} onKeyDown={(event) => activateByKey(event, index)}>{tab.label}</button>)}</div><div className="tabs__panel" id={panelId} role="tabpanel" aria-labelledby={`${value}-tab`}>{tabs.find((tab) => tab.id === value)?.content}</div></div>
}
export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  return <nav className="pagination" aria-label="Pagination"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button><span className="pagination__count">{page} <span className="muted">/</span> {pages}</span><Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button></nav>
}
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return <nav className="breadcrumb" aria-label="Breadcrumb">{items.map((item, index) => <span key={`${item.label}-${index}`} className="breadcrumb__item">{index > 0 && <span aria-hidden="true">/</span>}{item.href && index < items.length - 1 ? <a href={item.href}>{item.label}</a> : <span aria-current="page">{item.label}</span>}</span>)}</nav>
}
export function IconButton({ icon, label, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) { return <Button variant="icon" aria-label={label} title={label} {...props}><Icon name={icon} /></Button> }
