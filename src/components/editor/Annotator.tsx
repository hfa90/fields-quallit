import { useCallback, useEffect, useRef, useState } from 'react'
import { MoveUpRight, Circle, Square, PenLine, Type, Undo2, Trash2, X, Check, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

type Tool = 'arrow' | 'ellipse' | 'rect' | 'pen' | 'text'
type Shape =
  | { t: 'arrow' | 'ellipse' | 'rect'; c: string; w: number; x1: number; y1: number; x2: number; y2: number }
  | { t: 'pen'; c: string; w: number; pts: [number, number][] }
  | { t: 'text'; c: string; w: number; x: number; y: number; text: string }

const COLORS = ['#fe811e', '#ff3b30', '#1a9ca9', '#ffcc00', '#ffffff', '#1c1c1e']
const TOOLS: [Tool, typeof Circle, string][] = [['arrow', MoveUpRight, 'Seta'], ['ellipse', Circle, 'Círculo'], ['rect', Square, 'Retângulo'], ['pen', PenLine, 'Caneta'], ['text', Type, 'Texto']]
const MAX = 1920

function drawShape(ctx: CanvasRenderingContext2D, s: Shape) {
  ctx.strokeStyle = s.c; ctx.fillStyle = s.c; ctx.lineWidth = s.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  // contorno escuro sutil para destacar sobre qualquer fundo
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = s.w * 0.8
  if (s.t === 'pen') {
    ctx.beginPath(); s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke()
  } else if (s.t === 'rect') {
    ctx.strokeRect(Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.abs(s.x2 - s.x1), Math.abs(s.y2 - s.y1))
  } else if (s.t === 'ellipse') {
    ctx.beginPath()
    ctx.ellipse((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, Math.abs(s.x2 - s.x1) / 2 || 1, Math.abs(s.y2 - s.y1) / 2 || 1, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (s.t === 'arrow') {
    const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1), head = s.w * 4.5
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2 - Math.cos(a) * head * 0.6, s.y2 - Math.sin(a) * head * 0.6); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(s.x2, s.y2)
    ctx.lineTo(s.x2 - head * Math.cos(a - 0.45), s.y2 - head * Math.sin(a - 0.45))
    ctx.lineTo(s.x2 - head * Math.cos(a + 0.45), s.y2 - head * Math.sin(a + 0.45))
    ctx.closePath(); ctx.fill()
  } else if (s.t === 'text') {
    const size = s.w * 7
    ctx.font = `600 ${size}px -apple-system, BlinkMacSystemFont, Inter, sans-serif`
    ctx.textBaseline = 'top'
    const m = ctx.measureText(s.text), pad = size * 0.3
    ctx.shadowBlur = 0
    ctx.fillStyle = s.c === '#ffffff' || s.c === '#ffcc00' ? 'rgba(28,28,30,.85)' : 'rgba(255,255,255,.92)'
    ctx.beginPath(); ctx.roundRect(s.x - pad, s.y - pad, m.width + pad * 2, size + pad * 2, pad); ctx.fill()
    ctx.fillStyle = s.c; ctx.fillText(s.text, s.x, s.y)
  }
  ctx.shadowBlur = 0
}

/**
 * Editor de marcação de imagem (setas, círculos, retângulos, caneta e texto).
 * Recebe um arquivo ou URL e devolve um JPEG pronto para enviar.
 */
export default function Annotator({ source, onCancel, onDone }: { source: File | string; onCancel: () => void; onDone: (file: File) => void | Promise<void> }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const img = useRef<HTMLImageElement | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('arrow')
  const [color, setColor] = useState(COLORS[0])
  const [shapes, setShapes] = useState<Shape[]>([])
  const [draft, setDraft] = useState<Shape | null>(null)
  const [saving, setSaving] = useState(false)
  const [textAt, setTextAt] = useState<{ x: number; y: number } | null>(null)
  const [textVal, setTextVal] = useState('')
  const strokeW = useRef(6)

  // carrega a imagem
  useEffect(() => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    let url = ''
    el.onload = () => {
      const ratio = Math.min(1, MAX / Math.max(el.naturalWidth, el.naturalHeight))
      const c = canvas.current!
      c.width = Math.round(el.naturalWidth * ratio); c.height = Math.round(el.naturalHeight * ratio)
      strokeW.current = Math.max(3, Math.round(Math.max(c.width, c.height) / 220))
      img.current = el; setReady(true)
    }
    el.onerror = () => setError('Não foi possível abrir a imagem')
    if (typeof source === 'string') el.src = source + (source.includes('?') ? '&' : '?') + 'annot=1'
    else { url = URL.createObjectURL(source); el.src = url }
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [source])

  const redraw = useCallback(() => {
    const c = canvas.current, el = img.current
    if (!c || !el) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(el, 0, 0, c.width, c.height)
    shapes.forEach(s => drawShape(ctx, s))
    if (draft) drawShape(ctx, draft)
  }, [shapes, draft])
  useEffect(() => { if (ready) redraw() }, [ready, redraw])

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * canvas.current!.width, ((e.clientY - r.top) / r.height) * canvas.current!.height] as [number, number]
  }
  const down = (e: React.PointerEvent) => {
    if (!ready) return
    const [x, y] = pos(e)
    if (tool === 'text') { setTextAt({ x, y }); setTextVal(''); return }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const w = strokeW.current
    setDraft(tool === 'pen' ? { t: 'pen', c: color, w, pts: [[x, y]] } : { t: tool, c: color, w, x1: x, y1: y, x2: x, y2: y })
  }
  const move = (e: React.PointerEvent) => {
    if (!draft) return
    const [x, y] = pos(e)
    setDraft(d => !d ? d : d.t === 'pen' ? { ...d, pts: [...d.pts, [x, y]] } : d.t === 'text' ? d : { ...d, x2: x, y2: y })
  }
  const up = () => {
    if (!draft) return
    const tiny = draft.t !== 'pen' && draft.t !== 'text' && Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) < 8
    if (!tiny) setShapes(s => [...s, draft])
    setDraft(null)
  }
  const addText = () => {
    if (textAt && textVal.trim()) setShapes(s => [...s, { t: 'text', c: color, w: strokeW.current, x: textAt.x, y: textAt.y, text: textVal.trim() }])
    setTextAt(null)
  }

  const finish = async () => {
    const c = canvas.current!
    setSaving(true)
    try {
      redraw()
      const blob = await new Promise<Blob | null>(res => c.toBlob(res, 'image/jpeg', 0.88))
      if (!blob) throw new Error('Falha ao gerar a imagem')
      await onDone(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    } catch (e) {
      setError((e as Error).message || 'Não foi possível salvar (a imagem pode estar protegida contra edição)')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white">
      <div className="pt-safe flex items-center justify-between gap-2 px-3 py-2">
        <button onClick={onCancel} className="flex h-10 items-center gap-1 rounded-full px-3 text-[15px] text-white/90 hover:bg-white/10"><X className="size-5" />Cancelar</button>
        <span className="hidden text-[15px] font-semibold sm:block">Marcar imagem</span>
        <button onClick={finish} disabled={!ready || saving} className="flex h-10 items-center gap-1.5 rounded-full bg-brand-orange px-4 text-[15px] font-semibold disabled:opacity-50">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Inserir
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2">
        {!ready && !error && <Loader2 className="size-8 animate-spin text-white/60" />}
        {error && <p className="px-6 text-center text-[15px] text-white/80">{error}</p>}
        <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          className={cn('max-h-full max-w-full touch-none rounded-md', !ready && 'hidden', tool === 'text' ? 'cursor-text' : 'cursor-crosshair')} />
        {textAt && (
          <div className="absolute inset-x-4 bottom-4 mx-auto flex max-w-md gap-2 rounded-2xl bg-neutral-900/95 p-2 shadow-2xl">
            <input autoFocus value={textVal} onChange={e => setTextVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && addText()} placeholder="Digite o texto"
              className="h-10 min-w-0 flex-1 rounded-xl bg-white/10 px-3 text-[16px] outline-none placeholder:text-white/40" />
            <button onClick={addText} className="h-10 rounded-xl bg-brand-orange px-4 text-[15px] font-semibold">OK</button>
          </div>
        )}
      </div>

      <div className="pb-safe space-y-3 px-3 pb-3 pt-2">
        <div className="flex items-center justify-center gap-3">
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} aria-label={`Cor ${c}`}
              className={cn('size-7 rounded-full ring-2 ring-offset-2 ring-offset-black transition', color === c ? 'ring-white' : 'ring-transparent')} style={{ background: c }} />
          ))}
        </div>
        <div className="mx-auto flex max-w-md items-center justify-between rounded-2xl bg-white/10 p-1">
          {TOOLS.map(([k, I, l]) => (
            <button key={k} onClick={() => setTool(k)} title={l}
              className={cn('flex h-11 flex-1 flex-col items-center justify-center rounded-xl text-[10px]', tool === k ? 'bg-white text-black' : 'text-white/80')}>
              <I className="size-5" />{l}
            </button>
          ))}
          <span className="mx-1 h-8 w-px bg-white/20" />
          <button onClick={() => setShapes(s => s.slice(0, -1))} disabled={!shapes.length} title="Desfazer" className="flex h-11 w-12 flex-col items-center justify-center text-[10px] text-white/80 disabled:opacity-30"><Undo2 className="size-5" />Desfazer</button>
          <button onClick={() => setShapes([])} disabled={!shapes.length} title="Limpar" className="flex h-11 w-12 flex-col items-center justify-center text-[10px] text-white/80 disabled:opacity-30"><Trash2 className="size-5" />Limpar</button>
        </div>
      </div>
    </div>
  )
}
