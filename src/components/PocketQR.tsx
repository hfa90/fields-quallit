import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { Download, X } from 'lucide-react'
import { ANDROID_PAGE, APK_URL } from '../lib/native'
import { cn } from '../lib/utils'
import type { DroidArm } from './Droid'

/**
 * O robozinho tira do bolso o QR code do app:
 *  reach   → leva a mão ao bolso (olhando para ele)
 *  rummage → remexe lá dentro
 *  lift    → sobe o braço com o cartãozinho
 *  show    → o cartãozinho vira o QR de verdade, na mão dele
 *  stash   → guarda de volta
 */
export type PocketStage = 'idle' | 'reach' | 'rummage' | 'lift' | 'show' | 'stash'

export const onAndroidPhone = () => /Android/i.test(navigator.userAgent)

export function usePocket() {
  const [stage, setStage] = useState<PocketStage>('idle')
  const cur = useRef<PocketStage>('idle')
  const timers = useRef<number[]>([])
  const go = (s: PocketStage) => { cur.current = s; setStage(s) }
  const at = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => clear, [])

  const pull = useCallback(() => {
    if (cur.current !== 'idle') return
    clear()
    go('reach')
    at(() => go('rummage'), 480)
    at(() => go('lift'), 1300)
    at(() => go('show'), 1820)
  }, [])

  const stash = useCallback(() => {
    if (cur.current === 'idle' || cur.current === 'stash') return
    clear()
    if (cur.current !== 'show') { go('idle'); return }
    go('stash')
    at(() => go('idle'), 230)
  }, [])

  const arm: DroidArm | undefined = stage === 'reach' ? 'reach' : stage === 'rummage' ? 'rummage' : stage === 'idle' ? undefined : 'hold'
  return {
    stage, pull, stash,
    /** etapa atual (para timers que guardaram um render antigo) */
    now: () => cur.current,
    busy: stage === 'reach' || stage === 'rummage' || stage === 'lift',
    open: stage === 'show' || stage === 'stash',
    /** props para o <Droid> (o rosto acompanha a mão: olha para o bolso enquanto procura) */
    droid: {
      pocket: true, arm, card: stage === 'lift',
      ...(stage === 'reach' || stage === 'rummage' ? { look: 0.8, lookY: 1, tilt: 6, mood: 'happy' as const } : {}),
      ...(stage === 'lift' || stage === 'show' ? { mood: 'wink' as const, look: -0.5, lookY: -0.4, tilt: -4 } : {}),
    },
  }
}

/**
 * Cartão que sai do bolso. 'qr' (computador): QR code que abre a página do app no celular.
 * 'download' (celular Android): botão para baixar o APK direto — não dá para escanear a própria tela.
 */
export function PocketCard({ mode, leaving, onClose, className, style, children }: {
  mode: 'qr' | 'download'; leaving?: boolean; onClose: () => void; className?: string; style?: React.CSSProperties; children?: React.ReactNode
}) {
  const [qr, setQr] = useState('')
  useEffect(() => {
    if (mode !== 'qr') return
    QRCode.toDataURL(ANDROID_PAGE, { margin: 1, width: 320, color: { dark: '#1c1c1e', light: '#ffffff' } }).then(setQr).catch(() => setQr(''))
  }, [mode])

  const shell = 'pointer-events-auto absolute rounded-[18px] bg-surface text-left shadow-[0_0_0_0.5px_rgb(0_0_0/0.1),0_18px_40px_-10px_rgb(0_0_0/0.4)] dark:bg-neutral-800'
  const close = (
    <button onClick={onClose} aria-label="Guardar" className="absolute right-2 top-2 rounded-full p-1 text-neutral-400 hover:bg-neutral-900/5 dark:hover:bg-white/10"><X className="size-3.5" /></button>
  )

  if (mode === 'download') return (
    <div role="dialog" aria-label="Baixar o app Android" className={cn(shell, 'w-[220px] p-2.5', leaving ? 'qr-stash' : 'qr-pop', className)} style={style}>
      {close}
      <div className="flex items-center gap-2 pr-5">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="size-9 rounded-[10px] shadow-sm" />
        <div className="min-w-0">
          <p className="whitespace-nowrap text-[9.5px] font-semibold uppercase tracking-[.06em] text-[#1f9d57] dark:text-[#3ddc84]">Fields para Android</p>
          <p className="whitespace-nowrap text-[13px] font-semibold leading-tight text-neutral-900 dark:text-white">Guardei um pra você</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <a href={APK_URL} download className="press flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#3ddc84] text-[13px] font-semibold text-neutral-900">
          <Download className="size-3.5" />Baixar o app
        </a>
        <Link to="/android" className="text-[11.5px] font-medium text-neutral-500">Como instalar</Link>
      </div>
      {children}
    </div>
  )

  return (
    <div role="dialog" aria-label="QR code do app Android" className={cn(shell, 'flex w-[336px] gap-3 p-2.5', leaving ? 'qr-stash' : 'qr-pop', className)} style={style}>
      {close}
      <div className="relative size-[132px] shrink-0 overflow-hidden rounded-[12px] bg-white p-1.5 ring-1 ring-black/[.06]">
        {qr ? <img src={qr} alt="QR code para baixar o app Android" className="size-full [image-rendering:pixelated]" /> : <div className="size-full animate-pulse rounded-md bg-neutral-100" />}
        <span aria-hidden className="qr-scan pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent via-[#3ddc84]/40 to-transparent" />
      </div>
      <div className="flex min-w-0 flex-col py-1 pr-1">
        <p className="pr-5 text-[10.5px] font-semibold uppercase tracking-[.08em] text-[#1f9d57] dark:text-[#3ddc84]">Fields para Android</p>
        <p className="mt-1.5 text-[15px] font-semibold leading-tight text-neutral-900 dark:text-white">Aponte a câmera do celular</p>
        <p className="mt-1 text-[12px] leading-snug text-neutral-500 dark:text-neutral-400">Abre a página para instalar o app no seu Android.</p>
        <div className="mt-auto pt-2">
          <a href={APK_URL} download className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-600 dark:text-accent-400"><Download className="size-3" />ou baixe o APK direto</a>
          {children}
        </div>
      </div>
    </div>
  )
}
