import { useEffect, useState } from 'react'
import { Share, PlusSquare, Smartphone, X } from 'lucide-react'
import { Button, Modal } from './ui'

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferred: BIPEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as BIPEvent; listeners.forEach(l => l()) })
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || isIOS()

function useInstall() {
  const [, force] = useState(0)
  useEffect(() => { const l = () => force(n => n + 1); listeners.add(l); return () => { listeners.delete(l) } }, [])
  const [help, setHelp] = useState(false)
  const install = async () => {
    if (deferred) { await deferred.prompt(); deferred = null; force(n => n + 1) }
    else setHelp(true)
  }
  return { canPrompt: !!deferred, install, help, setHelp }
}

function IOSHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ios = isIOS()
  return (
    <Modal open={open} onClose={onClose} title="Instalar o app">
      <ol className="space-y-4 text-[15px] text-neutral-700 dark:text-neutral-300">
        {ios ? <>
          <li className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-accent-600 dark:bg-neutral-800"><Share className="size-4" /></span>Toque em <strong>Compartilhar</strong> na barra do Safari</li>
          <li className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"><PlusSquare className="size-4" /></span>Escolha <strong>Adicionar à Tela de Início</strong></li>
          <li className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-[13px] font-semibold text-accent-600 dark:bg-neutral-800">OK</span>Toque em <strong>Adicionar</strong></li>
        </> : <>
          <li>No Chrome, abra o menu <strong>⋮</strong></li>
          <li>Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong></li>
        </>}
      </ol>
      <p className="mt-5 text-[13px] text-neutral-500">O app abre em tela cheia, com ícone próprio, como um aplicativo nativo.</p>
    </Modal>
  )
}

/** Linha para a página de Perfil */
export function InstallRow() {
  const { install, help, setHelp } = useInstall()
  if (isStandalone()) return null
  return (
    <>
      <button onClick={install} className="flex min-h-12 w-full items-center gap-3 px-4 text-left">
        <span className="grid size-7 place-items-center rounded-[7px] bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"><Smartphone className="size-4" /></span>
        <span className="flex-1 text-[16px] text-neutral-900 dark:text-white">Instalar app no celular</span>
      </button>
      <IOSHelp open={help} onClose={() => setHelp(false)} />
    </>
  )
}

/** Faixa discreta exibida no celular até ser dispensada */
export function InstallBanner() {
  const { install, help, setHelp } = useInstall()
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('fq-install-dismissed') === '1' } catch { return false } })
  if (hidden || isStandalone() || !isMobile()) return null
  const dismiss = () => { setHidden(true); try { localStorage.setItem('fq-install-dismissed', '1') } catch { /* ignore */ } }
  return (
    <div className="card flex items-center gap-3 p-3 fade-up">
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="size-11 rounded-[10px]" />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-neutral-900 dark:text-white">Fields no seu celular</div>
        <div className="text-[13px] text-neutral-500">Instale o app para abrir com um toque</div>
      </div>
      <Button size="sm" onClick={install}>Instalar</Button>
      <button onClick={dismiss} className="p-1 text-neutral-400" aria-label="Dispensar"><X className="size-4" /></button>
      <IOSHelp open={help} onClose={() => setHelp(false)} />
    </div>
  )
}
