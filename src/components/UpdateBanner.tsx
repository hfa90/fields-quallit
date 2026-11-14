import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { APP_BUILD } from '../lib/version'

const CHECK_EVERY = 5 * 60 * 1000

/**
 * Quando o site é atualizado com o Fields aberto, mostra um aviso discreto para atualizar
 * (em vez de a tela quebrar ou recarregar sozinha no meio do uso).
 * Compara o build em uso com /downloads/site.json, gerado a cada publicação.
 */
export default function UpdateBanner() {
  const [fresh, setFresh] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (APP_BUILD === 'local') return
    let stop = false
    const check = async () => {
      if (stop || document.visibilityState !== 'visible' || !navigator.onLine) return
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}downloads/site.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!r.ok) return
        const v = await r.json() as { build: string; version: string }
        if (v.build && v.build !== APP_BUILD) setFresh(v.version)
      } catch { /* sem rede */ }
    }
    const iv = window.setInterval(check, CHECK_EVERY)
    const vis = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', vis)
    window.addEventListener('online', check)
    const first = window.setTimeout(check, 20000)
    return () => { stop = true; clearInterval(iv); clearTimeout(first); document.removeEventListener('visibilitychange', vis); window.removeEventListener('online', check) }
  }, [])

  if (!fresh || hidden) return null
  return (
    <div className="no-print bubble-in fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6">
      <div className="flex items-center gap-2 rounded-full bg-neutral-900 py-1.5 pl-4 pr-1.5 text-[13.5px] text-white shadow-[0_10px_30px_-8px_rgb(0_0_0/0.5)] dark:bg-neutral-100 dark:text-neutral-900">
        <span>Nova versão do Fields{fresh ? ` (v${fresh})` : ''} disponível</span>
        <button onClick={() => window.location.reload()} className="press inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-500 px-3 font-semibold text-white">
          <RefreshCw className="size-3.5" />Atualizar
        </button>
        <button onClick={() => setHidden(true)} aria-label="Depois" title="Depois" className="grid size-8 place-items-center rounded-full opacity-70 hover:opacity-100"><X className="size-4" /></button>
      </div>
    </div>
  )
}
