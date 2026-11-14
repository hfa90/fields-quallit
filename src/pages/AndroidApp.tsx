import { useEffect, useState } from 'react'
import { qrDataUrl } from '../lib/qr'
import { Download, ShieldCheck, Smartphone, Settings, CheckCircle2, ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ANDROID_PAGE, APK_URL, isNative } from '../lib/native'
import { Logo } from '../components/Layout'

/**
 * Página pública (não exige login) para instalar o app Android pelo QR code.
 * Endereço: /android
 */
export default function AndroidApp() {
  const [qr, setQr] = useState('')
  const [info, setInfo] = useState<{ versionName: string; size?: number; date?: string } | null>(null)
  const onAndroid = /Android/i.test(navigator.userAgent)

  useEffect(() => {
    qrDataUrl(ANDROID_PAGE, 440).then(setQr)
    fetch(`${import.meta.env.BASE_URL}downloads/version.json?t=${Date.now()}`).then(r => r.ok ? r.json() : null).then(setInfo).catch(() => {})
  }, [])

  return (
    <div className="pt-safe pb-safe min-h-dvh bg-neutral-50 px-5 py-8 dark:bg-neutral-950">
      <div className="mx-auto max-w-md space-y-6 fade-up">
        <Link to="/" className="-ml-2 inline-flex h-9 items-center text-[17px] text-accent-600 dark:text-accent-400"><ChevronLeft className="size-6" strokeWidth={2.2} />Fields</Link>

        <div className="flex items-center gap-4">
          <Logo size={72} />
          <div>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-neutral-900 dark:text-white">Fields para Android</h1>
            <p className="text-[15px] text-neutral-500">Central de tutoriais · Quallit Soluções em TI</p>
            {info && <p className="mt-0.5 text-[13px] text-neutral-400">Versão {info.versionName}{info.size ? ` · ${(info.size / 1048576).toFixed(1)} MB` : ''}</p>}
          </div>
        </div>

        {isNative ? (
          <div className="card flex items-center gap-3 p-4 text-[15px] text-neutral-700 dark:text-neutral-300">
            <CheckCircle2 className="size-6 shrink-0 text-[#34c759]" />Você já está usando o app Android.
          </div>
        ) : onAndroid ? (
          <a href={APK_URL} download className="press flex h-14 items-center justify-center gap-2 rounded-[14px] bg-accent-600 text-[17px] font-semibold text-white shadow-lg shadow-accent-600/25">
            <Download className="size-5" />Baixar e instalar o app
          </a>
        ) : (
          <div className="card flex flex-col items-center p-6 text-center">
            {qr && <img src={qr} alt="QR code para baixar o app" className="size-56 rounded-xl" />}
            <p className="mt-4 text-[15px] font-semibold text-neutral-900 dark:text-white">Aponte a câmera do celular Android</p>
            <p className="text-[14px] text-neutral-500">O QR code abre esta página no celular, com o botão para baixar o app.</p>
            <a href={APK_URL} download className="mt-4 text-[14px] font-medium text-accent-600">Ou baixe o arquivo APK direto</a>
          </div>
        )}

        <section className="card divide-y divide-neutral-200/70 overflow-hidden dark:divide-neutral-800">
          <h2 className="px-4 py-3 text-[15px] font-semibold text-neutral-900 dark:text-white">Como instalar</h2>
          {[
            [Download, 'Toque em “Baixar e instalar o app” e aguarde o download do arquivo fields.apk.'],
            [Settings, 'Abra o arquivo. Na primeira vez, o Android pede para permitir instalar apps desta fonte (Chrome ou Arquivos): toque em “Configurações” e ative “Permitir desta fonte”.'],
            [Smartphone, 'Volte e toque em “Instalar”. O ícone do Fields aparece na tela inicial.'],
            [CheckCircle2, 'Abra o app e entre com o mesmo e-mail e senha do site.'],
          ].map(([I, t], i) => {
            const Icon = I as typeof Download
            return (
              <div key={i} className="flex gap-3 px-4 py-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-500/10 text-[13px] font-semibold text-accent-700 dark:text-accent-300">{i + 1}</span>
                <p className="flex-1 text-[14px] leading-relaxed text-neutral-700 dark:text-neutral-300">{t as string}</p>
                <Icon className="mt-0.5 size-4 shrink-0 text-neutral-400" />
              </div>
            )
          })}
        </section>

        <div className="flex gap-3 rounded-[12px] bg-neutral-900/[.04] p-4 text-[13px] leading-relaxed text-neutral-600 dark:bg-white/5 dark:text-neutral-400">
          <ShieldCheck className="size-5 shrink-0 text-accent-600" />
          <span>O app é distribuído pela própria Quallit, fora da Play Store — por isso o Android pede a permissão de “fonte desconhecida”. Ele recebe as atualizações do site automaticamente; quando houver uma nova versão do app, ele mesmo avisa.</span>
        </div>
      </div>
    </div>
  )
}
