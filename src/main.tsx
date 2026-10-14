import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/global.css'
import './styles/components.css'
import './styles/storefront.css'
import './styles/motion.css'
import './styles/premium.css'
import './styles/design-system.css'

if (import.meta.env.DEV) {
  void import('./lib/performance').then(({ observeStorefrontPerformance }) => observeStorefrontPerformance())
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
