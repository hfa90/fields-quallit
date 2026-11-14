import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'

/**
 * Faixa horizontal que também funciona no computador:
 * setas nas laterais (aparecem quando há mais conteúdo) e arrastar com o mouse.
 * No celular continua o deslizar com o dedo.
 */
export default function HScroll({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  const drag = useRef<{ x: number; left: number; moved: boolean; id: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    const mo = new MutationObserver(update)
    mo.observe(el, { childList: true })
    // um arrasto não deve abrir o cartão onde o mouse foi solto
    const click = (e: MouseEvent) => { if (drag.current?.moved) { e.preventDefault(); e.stopPropagation(); drag.current = null } }
    el.addEventListener('click', click, true)
    return () => { el.removeEventListener('scroll', update); el.removeEventListener('click', click, true); ro.disconnect(); mo.disconnect() }
  }, [update])

  const go = (dir: 1 | -1) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: 'smooth' })
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !ref.current) return
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false, id: e.pointerId }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current, el = ref.current
    if (!d || !el || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) > 6) { d.moved = true; setDragging(true); el.setPointerCapture(e.pointerId) }
    if (d.moved) el.scrollLeft = d.left - dx
  }
  const end = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (ref.current?.hasPointerCapture(e.pointerId)) ref.current.releasePointerCapture(e.pointerId)
    setDragging(false)
    if (!d.moved) drag.current = null
    else setTimeout(() => { drag.current = null }, 0) // libera depois do clique ser ignorado
  }

  const arrow = 'absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-surface text-neutral-700 shadow-[0_0_0_0.5px_rgb(0_0_0/0.12),0_4px_14px_-2px_rgb(0_0_0/0.25)] transition hover:scale-105 hover:text-neutral-950 md:grid dark:bg-neutral-800 dark:text-neutral-200 dark:shadow-[0_0_0_0.5px_rgb(255_255_255/0.12),0_4px_14px_-2px_rgb(0_0_0/0.6)]'

  return (
    <div className="group/hs relative">
      <div ref={ref} role="region" aria-label={label}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={end} onPointerCancel={end}
        onDragStart={e => e.preventDefault()}
        className={cn('no-scrollbar overflow-x-auto overscroll-x-contain', dragging ? 'cursor-grabbing select-none [&_*]:pointer-events-none' : 'md:cursor-grab', className)}>
        {children}
      </div>
      {edges.left && <>
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] hidden w-12 bg-gradient-to-r from-neutral-50 to-transparent md:block dark:from-neutral-950" />
        <button type="button" aria-label="Voltar" onClick={() => go(-1)} className={cn(arrow, '-left-3')}><ChevronLeft className="size-5" /></button>
      </>}
      {edges.right && <>
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[5] hidden w-12 bg-gradient-to-l from-neutral-50 to-transparent md:block dark:from-neutral-950" />
        <button type="button" aria-label="Avançar" onClick={() => go(1)} className={cn(arrow, '-right-3')}><ChevronRight className="size-5" /></button>
      </>}
    </div>
  )
}
