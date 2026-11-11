import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import './index.css'
import App from './App'
import { AuthProvider } from './lib/auth'
import { entry } from './lib/entry'

// Retorno do redirecionamento do 404.html (GitHub Pages SPA)
const redirect = sessionStorage.getItem('fq-redirect')
if (redirect) {
  sessionStorage.removeItem('fq-redirect')
  window.history.replaceState(null, '', redirect)
}
entry.path = window.location.pathname

// App instalável / offline (somente em produção)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AuthProvider>
        <App />
        <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'var(--font-sans)', borderRadius: 14 } }} />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
