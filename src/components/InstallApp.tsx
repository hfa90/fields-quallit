import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Share, PlusSquare, Smartphone, MoreVertical, Download, Check, Zap, BellRing, WifiOff } from 'lucide-react'
import { Button } from './ui'
import { isIOS, isStandalone } from '../lib/push'
import { ANDROID_PAGE, APK_URL, isNative } from '../lib/native'
import { anyLocalPref } from '../lib/prefs'

export { isStandalone }

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferred: BIPEvent | null = null
const listeners = new Set<() => void>()
const openers = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as BIPEvent; listeners.forEach(l => l()) })
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach(l => l()) })
}

/** Abre o popup de instalação de qualquer lugar do app */
export function openInstallPrompt() { openers.forEach(o => o()) }

const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || isIOS()
const isAndroid = () => /Android/i.test(navigator.userAgent)
const isIOSSafari = () => isIOS() && /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent)

const KEY = 'fq-install'
function shouldAutoShow() {
  if (anyLocalPref('android_app', ['yes', 'dismissed'])) return false // já usa o app Android
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}') as { never?: boolean; until?: number }
    if (v.never) return false
    if (v.until && Date.now() < v.until) return false
  } catch { /* ignore */ }
  return true
}
function snooze(days: number | 'never') {
  try { localStorage.setItem(KEY, JSON.stringify(days === 'never' ? { never: true } : { until: Date.now() + days * 864e5 })) } catch { /* ignore */ }
}

/**
 * Popup que aparece automaticamente quando o site é aberto no celular (fora do app instalado),
 * explicando como instalar o Fields como aplicativo (PWA).
 */
export function InstallPrompt() {
  const [open, setOpen] = useState(false)
  const [, force] = useState(0)

  useEffect(() => {
    const l = () => force(n => n + 1)
    const o = () => setOpen(true)
    listeners.add(l); openers.add(o)
    return () => { listeners.delete(l); openers.delete(o) }
  }, [])

  // abre sozinho uma vez — mas não na tela de login, onde o robozinho já faz o convite (tira o app do bolso);
  // ao trocar de tela antes de 1,2 s (ex.: "/" → "/login") o timer é cancelado
  const { pathname } = useLocation()
  const tried = useRef(false)
  useEffect(() => {
    if (tried.current || pathname === '/login' || pathname === '/android') return
    if (isNative || !isMobile() || isStandalone() || !shouldAutoShow()) return
    const t = window.setTimeout(() => { tried.current = true; setOpen(true) }, 1200)
    return () => clearTimeout(t)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open || isNative) return null
  const close = (days: number | 'never' = 3) => { snooze(days); setOpen(false) }
  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const r = await deferred.userChoice
    deferred = null
    if (r.outcome === 'accepted') close('never')
  }
  const ios = isIOS()

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/45 animate-in" onClick={() => close(3)} />
      <div className="sheet-in relative w-full overflow-hidden rounded-t-[16px] bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-neutral-900 sm:max-w-sm sm:rounded-[16px]">
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-neutral-300 dark:bg-neutral-700 sm:hidden" />
        <div className="px-6 pt-5 text-center">
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="mx-auto size-[72px] rounded-[18px] shadow-lg" />
          <h2 className="mt-4 text-[22px] font-bold tracking-tight text-neutral-900 dark:text-white">Instale o Fields no celular</h2>
          <p className="mt-1 text-[15px] text-neutral-500">Abra a central com um toque, como um aplicativo.</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-[12px] text-neutral-600 dark:text-neutral-400">
            <span className="flex flex-col items-center gap-1"><Zap className="size-5 text-accent-600" />Abre rápido</span>
            <span className="flex flex-col items-center gap-1"><BellRing className="size-5 text-accent-600" />Notificações</span>
            <span className="flex flex-col items-center gap-1"><WifiOff className="size-5 text-accent-600" />Sinal fraco</span>
          </div>
        </div>

        <div className="mx-5 mt-5 rounded-[12px] bg-neutral-100 p-4 dark:bg-neutral-800">
          {ios ? (
            isIOSSafari() ? (
              <ol className="space-y-3 text-[15px] text-neutral-800 dark:text-neutral-200">
                <Step n={1} icon={<Share className="size-4 text-accent-600" />}>Toque em <b>Compartilhar</b> na barra do Safari</Step>
                <Step n={2} icon={<PlusSquare className="size-4" />}>Role e toque em <b>Adicionar à Tela de Início</b></Step>
                <Step n={3} icon={<Check className="size-4 text-accent-600" />}>Toque em <b>Adicionar</b> no canto superior</Step>
              </ol>
            ) : (
              <p className="text-[15px] text-neutral-800 dark:text-neutral-200">No iPhone, abra este endereço no <b>Safari</b> e use <b>Compartilhar → Adicionar à Tela de Início</b>.</p>
            )
          ) : deferred ? (
            <p className="text-center text-[15px] text-neutral-800 dark:text-neutral-200">Toque em <b>Instalar</b> e confirme. O ícone aparece na sua tela inicial.</p>
          ) : (
            <ol className="space-y-3 text-[15px] text-neutral-800 dark:text-neutral-200">
              <Step n={1} icon={<MoreVertical className="size-4" />}>Toque no menu <b>⋮</b> do {isAndroid() ? 'Chrome' : 'navegador'}</Step>
              <Step n={2} icon={<Download className="size-4 text-accent-600" />}>Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b></Step>
              <Step n={3} icon={<Check className="size-4 text-accent-600" />}>Confirme em <b>Instalar</b></Step>
            </ol>
          )}
        </div>

        <div className="space-y-1 px-5 pt-4">
          {isAndroid() ? (
            <>
              <a href={APK_URL} download onClick={() => close('never')} className="press flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-accent-600 text-[17px] font-semibold text-white">
                <Download className="size-5" />Baixar app Android
              </a>
              <a href={ANDROID_PAGE} className="block py-2 text-center text-[13px] font-medium text-accent-600">Como instalar o app</a>
              {deferred && <Button variant="ghost" className="h-11 w-full" onClick={install}>Ou instalar versão web</Button>}
            </>
          ) : deferred && !ios
            ? <Button className="h-12 w-full text-[17px] font-semibold" onClick={install}><Smartphone className="size-5" />Instalar</Button>
            : <Button className="h-12 w-full text-[17px] font-semibold" onClick={() => close(3)}>Entendi</Button>}
          <Button variant="ghost" className="h-11 w-full" onClick={() => close(3)}>Agora não</Button>
          <button onClick={() => close('never')} className="block w-full py-1 text-[13px] text-neutral-400">Não mostrar novamente</button>
        </div>
      </div>
    </div>
  )
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-[12px] font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">{n}</span>
      <span className="flex-1">{children}</span>
      <span className="text-neutral-500">{icon}</span>
    </li>
  )
}

/** Linha para a página de Perfil */
export function InstallRow() {
  if (isStandalone() || isNative) return null
  return (
    <button onClick={openInstallPrompt} className="flex min-h-12 w-full items-center gap-3 px-4 text-left">
      <span className="grid size-7 place-items-center rounded-[7px] bg-accent-600 text-white"><Smartphone className="size-4" /></span>
      <span className="flex-1 text-[16px] text-neutral-900 dark:text-white">Instalar app no celular</span>
    </button>
  )
}
