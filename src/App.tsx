import { lazy, Suspense } from 'react'
import { ExperienceBoundary } from './components/ExperienceBoundary'
import { ExperienceSkeleton } from './components/Experience'
import { StorefrontConfigProvider, StorefrontMetadata } from './features/storefront/StorefrontConfig'
import { I18nProvider, LanguageSwitcher } from './i18n/I18nProvider'
import { useReducedMotion } from './lib/motion'
import { CartFlight } from './components/CartFlight'

const CustomerSite = lazy(() => import('./features/storefront/CustomerSite'))
const AccountExperience = lazy(() => import('./features/account/AccountExperience'))
const CartExperience = lazy(() => import('./features/cart/CartExperience'))
const CheckoutExperience = lazy(() => import('./features/cart/CheckoutExperience'))
const AdminShell = lazy(() => import('./features/admin/AdminShell'))
const ProductDetailExperience = lazy(() => import('./features/catalog/ProductDetailExperience'))

export default function App() {
  useReducedMotion()
  const path = window.location.pathname
  const isAdmin = path.startsWith('/admin')
  const page = isAdmin ? <AdminShell />
    : path.startsWith('/account') ? <AccountExperience />
    : path === '/cart' ? <CartExperience />
      : path === '/checkout' ? <CheckoutExperience />
          : path.startsWith('/products/') ? <ProductDetailExperience />
            : <CustomerSite />
  const standalone = path === '/cart' || path === '/checkout' || path.startsWith('/account')
  return <I18nProvider><StorefrontConfigProvider><StorefrontMetadata pathname={window.location.pathname} />{standalone && <div className="global-language-switcher"><LanguageSwitcher compact /></div>}<CartFlight /><ExperienceBoundary><Suspense fallback={<main className="container" style={{ minHeight: '70vh' }}><ExperienceSkeleton /></main>}>{page}</Suspense></ExperienceBoundary></StorefrontConfigProvider></I18nProvider>
}
