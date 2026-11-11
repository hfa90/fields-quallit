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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AuthProvider>
        <App />
        <Toaster richColors position="top-center" closeButton />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
