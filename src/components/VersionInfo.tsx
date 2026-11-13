import { useEffect, useState } from 'react'
import { Sparkles, Info, Smartphone } from 'lucide-react'
import { APP_VERSION, CHANGELOG, versionLabel } from '../lib/version'
import { isNative } from '../lib/native'
import { Modal } from './ui'
import { cn } from '../lib/utils'

/** Versão do app Android instalado (só dentro do app) */
function useNativeVersion() {
  const [v, setV] = useState<string | null>(null)
  useEffect(() => {
    if (!isNative) return
    import('@capacitor/app').then(({ App }) => App.getInfo()).then(i => setV(`${i.version} (${i.build})`)).catch(() => {})
  }, [])
  return v
}

export function ChangelogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Novidades do Fields">
      <ol className="space-y-5">
        {CHANGELOG.map((c, i) => (
          <li key={c.version}>
            <div className="flex items-baseline gap-2">
              <span className={cn('rounded-md px-1.5 py-0.5 font-mono text-[12px] font-semibold', i === 0 ? 'bg-accent-600 text-white' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300')}>v{c.version}</span>
              <span className="text-[15px] font-semibold text-neutral-900 dark:text-white">{c.title}</span>
              <span className="ml-auto shrink-0 text-[12px] text-neutral-400">{new Date(c.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
            </div>
            <ul className="mt-2 space-y-1 pl-1">
              {c.items.map(it => <li key={it} className="flex gap-2 text-[14px] text-neutral-600 dark:text-neutral-400"><span className="mt-2 size-1 shrink-0 rounded-full bg-neutral-400" />{it}</li>)}
            </ul>
          </li>
        ))}
      </ol>
    </Modal>
  )
}

/** Bloco de versão para o Perfil e a Administração */
export function VersionCard() {
  const [open, setOpen] = useState(false)
  const nativeV = useNativeVersion()
  return (
    <>
      <div className="card overflow-hidden">
        <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">
          <span className="grid size-7 place-items-center rounded-[7px] bg-neutral-800 text-white dark:bg-neutral-600"><Info className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] text-neutral-900 dark:text-white">Versão do sistema</div>
            <div className="font-mono text-[12px] text-neutral-500">{versionLabel()}</div>
            {nativeV && <div className="mt-0.5 flex items-center gap-1 text-[12px] text-neutral-500"><Smartphone className="size-3" />App Android {nativeV}</div>}
          </div>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-full bg-accent-500/10 px-3 py-1.5 text-[13px] font-medium text-accent-700 dark:text-accent-300">
            <Sparkles className="size-3.5" />Novidades
          </button>
        </div>
      </div>
      <ChangelogModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** Texto pequeno de versão (login, rodapés) */
export function VersionTag({ className }: { className?: string }) {
  return <p className={cn('text-center font-mono text-[11px] text-neutral-400', className)}>Fields v{APP_VERSION}</p>
}

/** Mostra "O que há de novo" uma vez quando a versão muda */
/** Novidades da versão (não aparece junto com as boas-vindas de quem acabou de chegar) */
export function WhatsNewOnce({ suppress }: { suppress?: boolean }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    try {
      const seen = localStorage.getItem('fq-seen-version')
      if (seen !== APP_VERSION && !suppress) setOpen(true)
      localStorage.setItem('fq-seen-version', APP_VERSION)
    } catch { /* ignore */ }
  }, [])
  return <ChangelogModal open={open} onClose={() => setOpen(false)} />
}
