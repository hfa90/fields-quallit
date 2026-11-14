import { createPortal } from 'react-dom'
import { Share, PlusSquare, Check, MoreHorizontal, ArrowDown, ArrowUp } from 'lucide-react'
import { isIOS, isStandalone } from '../lib/push'
import { anyLocalPref } from '../lib/prefs'

/** De onde a pessoa está vendo o login, para escolher o convite certo */
export type Platform = 'android' | 'ios' | 'mac-safari' | 'desktop' | 'mobile-other'

export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'android'
  if (isIOS()) return 'ios'
  if (/Mobile/i.test(ua)) return 'mobile-other'
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox|OPR/.test(ua)) return 'mac-safari'
  return 'desktop'
}

const KEY = 'fq-login-pitch'
export function pitchSnoozed() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}') as { until?: number }; return !!v.until && Date.now() < v.until } catch { return false }
}
export function snoozePitch(days: number) {
  try { localStorage.setItem(KEY, JSON.stringify({ until: Date.now() + days * 864e5 })) } catch { /* ignore */ }
}

/** Vale a pena pedir para instalar? (já instalado, já tem o app ou dispensou há pouco → não) */
export function canPitch(p: Platform, canPrompt: boolean) {
  if (isStandalone() || pitchSnoozed()) return false
  if (p === 'android') return !anyLocalPref('android_app', ['yes'])
  if (p === 'ios') return true
  if (p === 'mac-safari') return Number(navigator.userAgent.match(/Version\/(\d+)/)?.[1] ?? 0) >= 17 // "Adicionar ao Dock"
  if (p === 'desktop') return canPrompt
  return false
}

/**
 * iPhone/iPad não deixam um site se instalar sozinho: este guia aponta para o botão certo do navegador
 * (Safari novo: "•••" embaixo à direita; Safari antigo: Compartilhar embaixo; iPad e Chrome: em cima).
 */
export function IosInstallGuide({ onClose }: { onClose: () => void }) {
  const ua = navigator.userAgent
  const ipad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  const safariVer = Number(ua.match(/Version\/(\d+)/)?.[1] ?? 0)
  const top = ipad || otherBrowser
  const moreMenu = !top && safariVer >= 26
  const arrowPos = top ? 'right-5 top-[max(10px,env(safe-area-inset-top))]' : moreMenu ? 'right-6 bottom-[max(14px,env(safe-area-inset-bottom))]' : 'left-1/2 -translate-x-1/2 bottom-[max(14px,env(safe-area-inset-bottom))]'

  return createPortal(
    <div className="fixed inset-0 z-[75]" role="dialog" aria-modal="true" aria-label="Instalar o Fields">
      <div className="absolute inset-0 bg-black/60 animate-in" onClick={onClose} />
      <div className={`pointer-events-none absolute ${arrowPos} flex flex-col items-center text-white`}>
        {top ? <ArrowUp className="m-arrow size-10 drop-shadow-lg" strokeWidth={2.6} /> : null}
        <span className="mt-1 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold backdrop-blur">{moreMenu ? 'Toque em •••' : 'Toque aqui'}</span>
        {!top ? <ArrowDown className="m-arrow mt-1 size-10 drop-shadow-lg" strokeWidth={2.6} /> : null}
      </div>
      <div className={`pop-in absolute inset-x-4 ${top ? 'top-[22%]' : 'top-[18%]'} mx-auto max-w-sm rounded-[20px] bg-surface p-5 shadow-2xl dark:bg-neutral-900`}>
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="size-12 rounded-[12px] shadow" />
          <div>
            <p className="text-[17px] font-bold text-neutral-900 dark:text-white">Fields na Tela de Início</p>
            <p className="text-[13px] text-neutral-500">Abre como app, em tela cheia</p>
          </div>
        </div>
        <ol className="mt-4 space-y-3 text-[15px] text-neutral-800 dark:text-neutral-200">
          {moreMenu && <Step n={1} icon={<MoreHorizontal className="size-4" />}>Toque em <b>•••</b> e depois em <b>Compartilhar</b></Step>}
          {!moreMenu && <Step n={1} icon={<Share className="size-4 text-accent-600" />}>Toque em <b>Compartilhar</b>{otherBrowser ? ' na barra de endereço' : ''}</Step>}
          <Step n={2} icon={<PlusSquare className="size-4" />}>Escolha <b>Adicionar à Tela de Início</b><span className="block text-[12.5px] text-neutral-500">Não achou? Role a lista ou toque em “Ver mais”</span></Step>
          <Step n={3} icon={<Check className="size-4 text-accent-600" />}>Toque em <b>Adicionar</b></Step>
        </ol>
        <button onClick={onClose} className="press mt-5 h-12 w-full rounded-[12px] bg-accent-600 text-[16px] font-semibold text-white">Entendi</button>
      </div>
    </div>,
    document.body,
  )
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-900/[.06] text-[12px] font-semibold text-neutral-700 dark:bg-white/10 dark:text-neutral-200">{n}</span>
      <span className="flex-1">{children}</span>
      <span className="text-neutral-500">{icon}</span>
    </li>
  )
}
