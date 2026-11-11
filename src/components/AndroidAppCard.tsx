import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { Download, WifiOff, Zap, Share2, ChevronRight } from 'lucide-react'
import { ANDROID_PAGE, APK_URL, isNative } from '../lib/native'
import { cn } from '../lib/utils'

/** Logotipo do Android (robô) */
function AndroidLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85a.637.637 0 0 0-.83.22l-1.88 3.24a11.43 11.43 0 0 0-8.94 0L5.65 5.67a.643.643 0 0 0-.87-.2c-.28.18-.37.54-.22.83L6.4 9.48A10.81 10.81 0 0 0 1 18h22a10.81 10.81 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
    </svg>
  )
}

/**
 * Cartão de divulgação do app Android na página inicial.
 * No celular Android: botão de download direto. No computador: QR code para apontar a câmera.
 * Dentro do próprio app não aparece.
 */
export default function AndroidAppCard({ compact }: { compact?: boolean }) {
  const [qr, setQr] = useState('')
  const [info, setInfo] = useState<{ versionName: string; size?: number } | null>(null)
  const onAndroid = /Android/i.test(navigator.userAgent)

  useEffect(() => {
    if (isNative) return
    if (!onAndroid) QRCode.toDataURL(ANDROID_PAGE, { margin: 1, width: 220, color: { dark: '#1c1c1e', light: '#ffffff' } }).then(setQr)
    fetch(`${import.meta.env.BASE_URL}downloads/version.json`).then(r => (r.ok ? r.json() : null)).then(setInfo).catch(() => {})
  }, [onAndroid])

  if (isNative) return null

  return (
    <section className="relative overflow-hidden rounded-[20px] bg-neutral-900 text-white dark:bg-neutral-900 dark:ring-1 dark:ring-white/10">
      {/* detalhe decorativo: robô do Android em marca d'água */}
      <AndroidLogo className="pointer-events-none absolute -bottom-6 -right-4 size-40 text-[#3ddc84] opacity-[.08]" />
      <div className={cn('relative flex flex-col gap-5 p-5', !compact && 'sm:flex-row sm:items-center sm:p-6')}>
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="relative shrink-0">
            <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="size-16 rounded-[16px] shadow-lg" />
            <span className="absolute -bottom-1.5 -right-1.5 grid size-7 place-items-center rounded-full bg-[#3ddc84] text-neutral-900 ring-[3px] ring-neutral-900">
              <AndroidLogo className="size-4" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[#3ddc84]">Novo · App para Android</div>
            <h2 className="mt-0.5 text-[20px] font-bold leading-tight tracking-tight">Fields no seu celular</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-white/65">Abra os tutoriais com um toque, use a câmera nos passos e consulte mesmo sem sinal em campo.</p>
            <div className={cn('mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/55', compact && 'hidden')}>
              <span className="inline-flex items-center gap-1"><Zap className="size-3.5" />Abre rápido</span>
              <span className="inline-flex items-center gap-1"><WifiOff className="size-3.5" />Funciona offline</span>
              <span className="inline-flex items-center gap-1"><Share2 className="size-3.5" />Compartilha pelo WhatsApp</span>
            </div>
          </div>
        </div>

        {onAndroid ? (
          <div className={cn('flex flex-col gap-2', !compact && 'sm:w-56')}>
            <a href={APK_URL} download className="press flex h-12 items-center justify-center gap-2 rounded-[12px] bg-[#3ddc84] text-[16px] font-semibold text-neutral-900">
              <Download className="size-5" />Baixar o app
            </a>
            <Link to="/android" className="flex items-center justify-center gap-0.5 text-[13px] font-medium text-white/70">
              Como instalar{info ? ` · v${info.versionName}` : ''}<ChevronRight className="size-4" />
            </Link>
          </div>
        ) : (
          <Link to="/android" className="press flex shrink-0 items-center gap-4 rounded-[14px] bg-white/[.06] p-3 pr-4 ring-1 ring-white/10 hover:bg-white/10">
            {qr ? <img src={qr} alt="QR code para baixar o app Android" className="size-[88px] rounded-lg bg-white p-1" /> : <span className="size-[88px] rounded-lg bg-white/10" />}
            <span className="text-[13px] leading-snug">
              <span className="block font-semibold text-white">Aponte a câmera</span>
              <span className="block text-white/60">do celular Android<br />para instalar</span>
              {info && <span className="mt-1.5 block text-[11px] text-white/40">v{info.versionName}{info.size ? ` · ${(info.size / 1048576).toFixed(1)} MB` : ''}</span>}
            </span>
          </Link>
        )}
      </div>
    </section>
  )
}
