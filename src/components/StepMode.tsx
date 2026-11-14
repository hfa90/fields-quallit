import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, Check, PartyPopper, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react'
import TutorialContent from './TutorialContent'
import type { Step } from '../lib/steps'
import { cn } from '../lib/utils'

/**
 * Modo "seguindo o tutorial": tela cheia, um passo por vez, botões grandes.
 * Pensado para quem está com uma mão no equipamento e a outra no celular:
 * a tela não apaga, dá para deslizar entre os passos e marcar cada um como feito.
 */
export default function StepMode({ title, steps, start = 0, initialDone = [], onClose, onChange, onFinish }: {
  title: string
  steps: Step[]
  start?: number
  initialDone?: number[]
  onClose: () => void
  onChange: (step: number, done: number[]) => void
  onFinish: (helpful: boolean | null) => void
}) {
  const [i, setI] = useState(() => Math.min(Math.max(start, 0), steps.length - 1))
  const [done, setDone] = useState<Set<number>>(() => new Set(initialDone))
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  const [finished, setFinished] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const total = steps.length
  const s = steps[i]
  const last = i === total - 1

  useEffect(() => { onChange(i, [...done]) }, [i, done]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }) }, [i])

  // tela cheia: trava a rolagem do fundo e mantém a tela acesa
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    const acquire = () => nav.wakeLock?.request('screen').then(l => { lock = l }).catch(() => {})
    acquire()
    const vis = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', vis)
    return () => { document.body.style.overflow = prev; lock?.release().catch(() => {}); document.removeEventListener('visibilitychange', vis) }
  }, [])

  const go = (n: number) => {
    if (n < 0) return
    if (n >= total) { setFinished(true); return }
    setDir(n > i ? 'next' : 'prev'); setFinished(false); setI(n)
  }
  const toggle = () => setDone(d => { const x = new Set(d); if (x.has(i)) x.delete(i); else x.add(i); return x })
  const doneAndNext = () => { setDone(d => new Set(d).add(i)); go(i + 1) }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() }
      else if (finished) return
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(i + 1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(i - 1) }
      else if (e.key === ' ' || e.key === 'Enter') { if ((e.target as HTMLElement).closest('button,a')) return; e.preventDefault(); doneAndNext() }
    }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }) // sempre com o passo atual

  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY } }
  const onTouchEnd = (e: React.TouchEvent) => {
    const st = touch.current; touch.current = null
    if (!st || finished) return
    const t = e.changedTouches[0]
    const dx = t.clientX - st.x, dy = t.clientY - st.y
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? i + 1 : i - 1)
  }

  const doneCount = done.size

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-neutral-50 dark:bg-black" role="dialog" aria-modal="true" aria-label={`Passo a passo: ${title}`}>
      {/* topo */}
      <div className="pt-safe material hairline-b shrink-0">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3">
          <button onClick={onClose} className="grid size-10 place-items-center rounded-full text-neutral-600 hover:bg-neutral-900/5 dark:text-neutral-300 dark:hover:bg-white/10" aria-label="Sair do passo a passo"><X className="size-6" /></button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-neutral-900 dark:text-white">{title}</div>
            <div className="text-[12px] text-neutral-500">{finished ? 'Concluído' : `Passo ${i + 1} de ${total}`} · {doneCount} feito{doneCount === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 px-4 pb-2.5" aria-hidden>
          {steps.map((_, k) => (
            <button key={k} tabIndex={-1} onClick={() => go(k)}
              className={cn('h-1.5 flex-1 rounded-full transition-colors', done.has(k) ? 'bg-[#34c759]' : k === i && !finished ? 'bg-accent-600' : 'bg-neutral-300 dark:bg-neutral-700')} />
          ))}
        </div>
      </div>

      {/* passo */}
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {finished ? (
          <div className="fade-up mx-auto flex max-w-md flex-col items-center px-6 py-14 text-center">
            <span className="badge-pop grid size-24 place-items-center rounded-full bg-[#34c759] text-white shadow-xl"><PartyPopper className="size-11" /></span>
            <h2 className="mt-6 text-[26px] font-bold tracking-tight text-neutral-900 dark:text-white">Chegou ao fim!</h2>
            <p className="mt-1 text-[16px] text-neutral-600 dark:text-neutral-400">{doneCount === total ? 'Todos os passos feitos.' : `${doneCount} de ${total} passos marcados como feitos.`} Funcionou para você?</p>
            <div className="mt-6 grid w-full gap-2">
              <button onClick={() => onFinish(true)} className="press flex h-14 items-center justify-center gap-2 rounded-[16px] bg-[#34c759] text-[17px] font-semibold text-white"><ThumbsUp className="size-5" />Funcionou!</button>
              <button onClick={() => onFinish(false)} className="press flex h-14 items-center justify-center gap-2 rounded-[16px] bg-neutral-900/[.06] text-[17px] font-semibold text-neutral-800 dark:bg-white/10 dark:text-neutral-100"><ThumbsDown className="size-5" />Não funcionou</button>
              <button onClick={() => onFinish(null)} className="mt-1 h-11 text-[15px] font-medium text-neutral-500">Responder depois</button>
              <button onClick={() => { setDone(new Set()); setFinished(false); setDir('prev'); setI(0) }} className="inline-flex h-10 items-center justify-center gap-1.5 text-[14px] font-medium text-accent-600 dark:text-accent-400"><RotateCcw className="size-4" />Recomeçar do primeiro passo</button>
            </div>
          </div>
        ) : (
          <div key={i} className={cn('mx-auto max-w-3xl px-5 py-6 sm:py-8', dir === 'next' ? 'step-next' : 'step-prev')}>
            {s.section && <div className="text-[13px] font-semibold uppercase tracking-wide text-accent-600 dark:text-accent-400">{s.section}</div>}
            <div className="mt-1 flex items-center gap-3">
              {s.numbered && <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-600 text-[20px] font-bold text-white">{s.n}</span>}
              <h2 className="text-[22px] font-bold tracking-tight text-neutral-900 dark:text-white">{s.numbered ? `Passo ${s.n}` : s.section || 'Antes de começar'}</h2>
              {done.has(i) && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#34c759]/15 px-2.5 py-1 text-[13px] font-semibold text-[#248a3d] dark:text-[#30d158]"><Check className="size-4" />Feito</span>}
            </div>
            <div className="step-content mt-5 text-[18px]">
              <TutorialContent html={s.html} />
            </div>
          </div>
        )}
      </div>

      {/* controles grandes */}
      {!finished && (
        <div className="pb-safe material hairline-t shrink-0">
          <div className="mx-auto grid max-w-3xl grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-3">
            <button onClick={() => go(i - 1)} disabled={i === 0} aria-label="Passo anterior"
              className="press grid h-14 w-16 place-items-center rounded-[16px] bg-neutral-900/[.06] text-neutral-800 disabled:opacity-30 dark:bg-white/10 dark:text-neutral-100">
              <ChevronLeft className="size-7" />
            </button>
            <button onClick={toggle} aria-pressed={done.has(i)}
              className={cn('press flex h-14 items-center justify-center gap-2.5 rounded-[16px] text-[17px] font-semibold transition-colors',
                done.has(i) ? 'bg-[#34c759] text-white' : 'bg-surface text-neutral-800 shadow-[inset_0_0_0_2px_rgb(0_0_0/0.12)] dark:bg-neutral-900 dark:text-neutral-100 dark:shadow-[inset_0_0_0_2px_rgb(255_255_255/0.15)]')}>
              <span className={cn('grid size-7 place-items-center rounded-[8px] border-2', done.has(i) ? 'border-white bg-white text-[#34c759]' : 'border-neutral-400')}>
                {done.has(i) && <Check className="size-5" strokeWidth={3} />}
              </span>
              {done.has(i) ? 'Feito' : 'Marcar como feito'}
            </button>
            <button onClick={() => go(i + 1)} aria-label={last ? 'Concluir' : 'Próximo passo'}
              className="press flex h-14 min-w-16 items-center justify-center gap-1 rounded-[16px] bg-accent-600 px-4 text-[17px] font-semibold text-white">
              <span className="hidden sm:inline">{last ? 'Concluir' : 'Próximo'}</span><ChevronRight className="size-7" />
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
