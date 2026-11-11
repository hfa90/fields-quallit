import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import './index.css'
import App from './App'
import { AuthProvider } from './lib/auth'
import { entry } from './lib/entry'
import { initNative } from './lib/native'
import ErrorBoundary, { reloadForNewVersion } from './components/ErrorBoundary'

// Retorno do redirecionamento do 404.html (GitHub Pages SPA)
const redirect = sessionStorage.getItem('fq-redirect')
if (redirect) {
  sessionStorage.removeItem('fq-redirect')
  window.history.replaceState(null, '', redirect)
}
entry.path = window.location.pathname
initNative()

// Site atualizado enquanto o app estava aberto: busca a versão nova em vez de travar
window.addEventListener('vite:preloadError', e => { e.preventDefault(); reloadForNewVersion() })

// Comportamento de app nativo: sem zoom por pinça, gesto ou Ctrl+roda
const stop = (e: Event) => e.preventDefault()
document.addEventListener('gesturestart', stop, { passive: false })
document.addEventListener('gesturechange', stop, { passive: false })
document.addEventListener('gestureend', stop, { passive: false })
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault() }, { passive: false })
document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault() }, { passive: false })

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
        <ErrorBoundary full>
          <App />
        </ErrorBoundary>
        <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'var(--font-sans)', borderRadius: 14 } }} />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
