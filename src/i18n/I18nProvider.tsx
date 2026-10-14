import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { messages, type Locale } from './translations'
import { delight } from './delight'
import { orderUI } from './order-ui'
import { invoiceUI } from './invoice'
import { shoppingGuides } from './shopping-guides'

const storageKey = 'aster-loom-locale'
type I18nContextValue = { locale: Locale; setLocale: (locale: Locale) => void; setDefaultLocale: (locale: Locale) => void; t: (key: string, values?: Record<string, string | number>) => string; localized: <T,>(value: T | Partial<Record<Locale, T>> | null | undefined) => T | undefined }
const I18nContext = createContext<I18nContextValue | null>(null)

function readLocale(): Locale {
  try { return localStorage.getItem(storageKey) === 'bn' ? 'bn' : 'en' } catch { return 'en' }
}

function lookup(source: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((current, part) => current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined, source)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readLocale)
  const [explicit, setExplicit] = useState(() => { try { return localStorage.getItem(storageKey) !== null } catch { return false } })
  const setLocale = useCallback((next: Locale) => {
    setExplicit(true)
    setLocaleState(next)
    try { localStorage.setItem(storageKey, next) } catch { /* The current page still uses the selected language. */ }
  }, [])
  const setDefaultLocale = useCallback((next: Locale) => { if (!explicit) setLocaleState(next) }, [explicit])
  useEffect(() => {
    document.documentElement.lang = locale === 'bn' ? 'bn' : 'en'
    document.documentElement.dir = 'ltr'
    document.documentElement.dataset.locale = locale
  }, [locale])
  const t = useCallback((key: string, values?: Record<string, string | number>) => {
    const selected = lookup({ ...messages[locale], delight: delight[locale], orderUI: orderUI[locale], invoiceUI: invoiceUI[locale], guides: shoppingGuides[locale] } as unknown as Record<string, unknown>, key)
    const fallback = lookup({ ...messages.en, delight: delight.en, orderUI: orderUI.en, invoiceUI: invoiceUI.en, guides: shoppingGuides.en } as unknown as Record<string, unknown>, key)
    const template = typeof selected === 'string' ? selected : typeof fallback === 'string' ? fallback : key
    return template.replace(/\{\{(\w+)\}\}/g, (_match, token: string) => String(values?.[token] ?? ''))
  }, [locale])
  const localized = useCallback(<T,>(value: T | Partial<Record<Locale, T>> | null | undefined): T | undefined => {
    if (value == null) return undefined
    if (typeof value !== 'object' || Array.isArray(value)) return value as T
    const record = value as Partial<Record<Locale, T>>
    if ('en' in record || 'bn' in record) return record[locale] ?? record.en ?? record.bn
    return value as T
  }, [locale])
  const context = useMemo(() => ({ locale, setLocale, setDefaultLocale, t, localized }), [locale, setLocale, setDefaultLocale, t, localized])
  return <I18nContext.Provider value={context}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within I18nProvider')
  return context
}

export function LanguageSwitcher({ compact = false, locales = ['en', 'bn'] }: { compact?: boolean; locales?: Locale[] }) {
  const { locale, setLocale, t } = useI18n()
  if (locales.length < 2) return null
  return <div className={`language-switcher${compact ? ' language-switcher--compact' : ''}`} role="group" aria-label={t('common.language')}>
    <button type="button" lang="en" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
    <span aria-hidden="true">|</span>
    <button type="button" lang="bn" aria-pressed={locale === 'bn'} onClick={() => setLocale('bn')}>বাংলা</button>
  </div>
}
