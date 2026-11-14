import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Download, X } from 'lucide-react'
import { isNative } from '../lib/native'
import { ANDROID_PREF, usePref } from '../lib/prefs'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/utils'
import { useAttention } from '../lib/attention'
import Droid from './Droid'
import { PocketCard, usePocket } from './PocketQR'

type Phase = 'wait' | 'in' | 'talk' | 'out' | 'peek'

/**
 * Convite discreto para o app Android (substitui o cartão grande da página inicial):
 * 1) uma única vez, o robozinho entra pela lateral, acena e pede para ser instalado; depois sai do mesmo jeito;
 * 2) a partir daí fica só a cabecinha espiando na lateral de todas as telas — tocar nela abre o convite.
 * Não aparece no app, para quem já usa o app ou para quem tocou em "Não mostrar mais".
 */
export default function AndroidBuddy({ hold }: { hold?: boolean }) {
  const { profile } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const [app, setApp] = usePref('android_app', ANDROID_PREF, 'no')
  const [intro, setIntro] = useState(() => { try { return localStorage.getItem('fq-droid-intro') === 'done' ? 'done' : 'pending' } catch { return 'done' } })
  const [phase, setPhase] = useState<Phase>('wait')
  const [bubble, setBubble] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // no computador, em vez do balão, ele tira do bolso o QR code para instalar pelo celular
  const pocket = usePocket()
  const desk = !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

  const hiddenRoute = /^\/(novo|dica|android)|\/editar$/.test(loc.pathname)
  const active = !isNative && !!profile && app === 'no'

  // a entrada só acontece num acesso em que nenhum outro aviso automático foi mostrado
  const introTurn = useAttention('droid', active && !hold && intro === 'pending')

  // roteiro da entrada (uma vez por aparelho)
  useEffect(() => {
    if (!active || hold) return
    if (intro === 'done') { setPhase('peek'); return }
    if (!introTurn) return
    // só entra quando nenhuma janela (novidades, boas-vindas…) estiver aberta há ~2 s
    let free = 0, t2: number | undefined
    const iv = window.setInterval(() => {
      free = document.body.style.overflow === 'hidden' ? 0 : free + 1
      if (free >= 4) {
        window.clearInterval(iv)
        setPhase('in')
        t2 = window.setTimeout(() => setPhase('talk'), 900)
      }
    }, 500)
    return () => { window.clearInterval(iv); window.clearTimeout(t2) }
  }, [active, hold, intro, introTurn])

  // sai sozinho depois de um tempo (com o QR na mão, espera mais para dar tempo de pegar o celular)
  useEffect(() => {
    if (phase !== 'talk') return
    const p = desk ? window.setTimeout(pocket.pull, 700) : undefined
    const t = window.setTimeout(() => leave(), desk ? 18000 : 9000)
    return () => { clearTimeout(t); clearTimeout(p) }
  }, [phase])

  // fechar o balão ao tocar fora
  useEffect(() => {
    if (!bubble) return
    const h = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setBubble(false) }
    document.addEventListener('pointerdown', h, true)
    return () => document.removeEventListener('pointerdown', h, true)
  }, [bubble])

  const leave = () => {
    try { localStorage.setItem('fq-droid-intro', 'done') } catch { /* ignore */ }
    const out = () => { setPhase('out'); window.setTimeout(() => { setIntro('done'); setPhase('peek') }, 800) }
    if (pocket.now() === 'idle') out()
    else { pocket.stash(); window.setTimeout(out, 450) } // guarda o QR no bolso antes de ir embora
  }
  const install = () => { setBubble(false); if (phase === 'talk') leave(); nav('/android') }
  const never = () => { setBubble(false); setApp('dismissed') }

  if (!active || hiddenRoute || phase === 'wait') return null
  const bottom = 'bottom-[calc(76px+env(safe-area-inset-bottom)+56px)] md:bottom-8'

  return createPortal(
    <div ref={ref} className={cn('no-print pointer-events-none fixed right-0 z-30', bottom)}>
      {(phase === 'in' || phase === 'talk' || phase === 'out') ? (
        <div className={cn('pointer-events-auto relative mr-3 md:mr-6', phase === 'out' ? 'droid-out' : 'droid-in')}>
          {phase === 'talk' && desk && pocket.busy && (
            <div className="bubble-in absolute bottom-[calc(100%-2px)] right-[64px] w-max rounded-[16px] rounded-br-[6px] bg-surface px-3.5 py-2.5 text-[13.5px] text-neutral-800 shadow-[0_0_0_0.5px_rgb(0_0_0/0.1),0_10px_28px_-8px_rgb(0_0_0/0.3)] dark:bg-neutral-800 dark:text-neutral-100">
              Oi! Pera… guardei uma coisa aqui pra você.
            </div>
          )}
          {phase === 'talk' && desk && pocket.open && (
            <PocketCard mode="qr" leaving={pocket.stage === 'stash'} onClose={leave} className="bottom-[calc(100%-10px)] right-[-12px]"
              style={{ '--qr-origin': '97% 100%' } as React.CSSProperties}>
              <button onClick={never} className="mt-1 block text-[11.5px] text-neutral-400 hover:text-neutral-500">Não mostrar mais</button>
            </PocketCard>
          )}
          {phase === 'talk' && !desk && (
            <div className="bubble-in absolute bottom-[calc(100%-6px)] right-[70px] w-[248px] rounded-[18px] rounded-br-[6px] bg-surface p-3.5 text-left shadow-[0_0_0_0.5px_rgb(0_0_0/0.1),0_12px_32px_-8px_rgb(0_0_0/0.35)] dark:bg-neutral-800">
              <button onClick={leave} aria-label="Fechar" className="absolute right-2 top-2 rounded-full p-1 text-neutral-400 hover:bg-neutral-900/5 dark:hover:bg-white/10"><X className="size-3.5" /></button>
              <p className="pr-5 text-[14.5px] font-semibold text-neutral-900 dark:text-white">Oi! Eu sou o Fields para Android 👋</p>
              <p className="mt-1 text-[13px] leading-snug text-neutral-600 dark:text-neutral-300">Me instala no seu celular? Eu abro rapidinho, uso a câmera e funciono até sem sinal no CD.</p>
              <div className="mt-2.5 flex gap-2">
                <button onClick={install} className="press inline-flex h-8 items-center gap-1.5 rounded-full bg-[#3ddc84] px-3 text-[13px] font-semibold text-neutral-900"><Download className="size-3.5" />Quero instalar</button>
                <button onClick={leave} className="press h-8 rounded-full px-3 text-[13px] font-medium text-neutral-500 hover:bg-neutral-900/5 dark:hover:bg-white/10">Agora não</button>
              </div>
            </div>
          )}
          {desk
            ? <Droid size={92} wave={phase === 'talk' && pocket.stage === 'idle'} mood={phase === 'talk' ? 'happy' : 'wink'} look={-0.6} {...pocket.droid} />
            : <Droid size={92} wave={phase === 'talk'} mood={phase === 'talk' ? 'happy' : 'wink'} look={-0.6} />}
        </div>
      ) : (
        <div className="pointer-events-auto relative">
          {bubble && (
            <div className="bubble-in absolute bottom-[calc(100%+4px)] right-3 w-[230px] rounded-[16px] rounded-br-[6px] bg-surface p-3 shadow-[0_0_0_0.5px_rgb(0_0_0/0.1),0_12px_32px_-8px_rgb(0_0_0/0.35)] dark:bg-neutral-800">
              <p className="text-[13.5px] font-semibold text-neutral-900 dark:text-white">Psiu! Me instala no celular? 📲</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button onClick={install} className="press inline-flex h-8 items-center gap-1.5 rounded-full bg-[#3ddc84] px-3 text-[12.5px] font-semibold text-neutral-900"><Download className="size-3.5" />Instalar</button>
                <button onClick={never} className="press h-8 rounded-full px-2.5 text-[12.5px] font-medium text-neutral-500 hover:bg-neutral-900/5 dark:hover:bg-white/10">Não mostrar mais</button>
              </div>
            </div>
          )}
          <button onClick={() => setBubble(b => !b)} aria-label="App Fields para Android" title="App Fields para Android"
            className="group block outline-none transition-transform duration-300 hover:-translate-x-2 focus-visible:-translate-x-2">
            <span className="droid-peek block drop-shadow-[0_3px_6px_rgb(0_0_0/0.25)]" style={{ transformOrigin: '70% 100%' }}>
              <Droid headOnly size={64} mood={bubble ? 'wink' : 'happy'} look={-1} />
            </span>
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}
