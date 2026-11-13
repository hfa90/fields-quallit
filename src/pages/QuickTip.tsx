import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Zap, Mic, MicOff, Camera, ImagePlus, X, Send, ChevronLeft, PenTool, Info, HandHelping } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { uploadImage } from '../lib/upload'
import { useDictation } from '../lib/speech'
import type { Category } from '../lib/types'
import { cn, errMsg } from '../lib/utils'
import { Button, CategoryIcon, inputCls, labelCls, textareaCls } from '../components/ui'

const Annotator = lazy(() => import('../components/editor/Annotator'))

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** Texto livre -> HTML: linhas numeradas viram passos; o resto vira parágrafos */
function toHtml(text: string) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean)
  const steps = lines.filter(l => /^\d+[.)-]\s*/.test(l))
  if (steps.length >= 2 && steps.length >= lines.length - 1) {
    return `<ol>${lines.map(l => `<li><p>${esc(l.replace(/^\d+[.)-]\s*/, ''))}</p></li>`).join('')}</ol>`
  }
  return lines.map(l => `<p>${esc(l)}</p>`).join('')
}

/**
 * Dica rápida: registrar um problema resolvido em 30 segundos.
 * Vira um item da biblioteca (tipo "quick") que pode depois ser transformado em tutorial completo.
 */
export default function QuickTip() {
  const nav = useNavigate()
  const { profile } = useAuth()
  const [sp] = useSearchParams()
  const requestId = sp.get('pedido')
  const [problem, setProblem] = useState(sp.get('problema') ?? '')
  const [solution, setSolution] = useState('')
  const [cats, setCats] = useState<Category[]>([])
  const [cat, setCat] = useState('')
  const [photos, setPhotos] = useState<{ key: string; file: File; url: string }[]>([])
  const [annot, setAnnot] = useState<{ key: string; file: File } | null>(null)
  const [busy, setBusy] = useState(false)
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)
  const dict = useDictation(t => setSolution(s => (s ? `${s}${/[.!?]$/.test(s) ? ' ' : '. '}` : '') + t.charAt(0).toUpperCase() + t.slice(1)))

  useEffect(() => {
    supabase.from('kb_categories').select('*').order('sort_order').then(({ data }) => setCats(data ?? []))
  }, [])
  useEffect(() => () => photos.forEach(p => URL.revokeObjectURL(p.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const addPhotos = (files: FileList | null) => {
    if (!files) return
    const list = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 4 - photos.length)
    setPhotos(p => [...p, ...list.map(file => ({ key: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))])
  }

  const publish = async () => {
    if (problem.trim().length < 5) return toast.error('Descreva o problema em poucas palavras (mín. 5 letras)')
    if (solution.trim().length < 10) return toast.error('Conte como resolveu (mín. 10 letras)')
    setBusy(true)
    try {
      const imgs: string[] = []
      for (const p of photos) imgs.push(await uploadImage(p.file, profile!.id))
      const html = `<div data-callout="info"><p><strong>Problema:</strong> ${esc(problem.trim())}</p></div>`
        + `<h2>Como resolver</h2>${toHtml(solution)}`
        + imgs.map(src => `<img src="${src}" alt="Foto da solução">`).join('')
      const id = crypto.randomUUID()
      const { data, error } = await supabase.from('kb_tutorials').insert({
        id, kind: 'quick', status: 'published',
        title: problem.trim().replace(/\?$/, '').slice(0, 200),
        summary: solution.trim().replace(/\s+/g, ' ').slice(0, 220),
        content_html: html, content_json: null,
        category_id: cat || null, difficulty: 'basico', tags: [],
      }).select('short_code').single()
      if (error) throw error
      if (requestId) await supabase.rpc('kb_answer_request', { p_request: requestId, p_tutorial: id })
      toast.success('Obrigado por compartilhar! 🙌', { description: 'Sua dica já está na biblioteca e pode ajudar colegas de todos os CDs.' })
      nav(`/t/${data.short_code}`, { replace: true, state: { inApp: true } })
    } catch (e) { toast.error(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-28 fade-up sm:pb-0">
      <button onClick={() => nav(-1)} className="-ml-2 inline-flex h-9 items-center text-[17px] text-accent-600 dark:text-accent-400"><ChevronLeft className="size-6" strokeWidth={2.2} />Voltar</button>

      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-brand-orange text-white shadow-lg shadow-brand-orange/30"><Zap className="size-6" /></span>
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-neutral-900 dark:text-white">Dica rápida</h1>
          <p className="text-[15px] text-neutral-500">Resolveu um problema? Conte em 30 segundos.</p>
        </div>
      </div>

      {sp.get('problema') && (
        <div className="flex items-start gap-2.5 rounded-[12px] bg-brand-orange/10 px-4 py-3 text-[14px] text-neutral-800 dark:text-neutral-200">
          <HandHelping className="mt-0.5 size-4 shrink-0 text-brand-orange" />Colegas procuraram por isso e não encontraram. Sua dica vai ajudar!
        </div>
      )}

      <section className="card space-y-4 p-4 sm:p-5">
        <div>
          <label className={labelCls}>1. Qual era o problema?</label>
          <input className={inputCls} value={problem} onChange={e => setProblem(e.target.value)} maxLength={200}
            placeholder="Ex.: Impressora Zebra imprimindo etiqueta em branco" autoFocus={!problem} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className={cn(labelCls, 'mb-0')}>2. Como você resolveu?</label>
            {dict.supported && (
              <button type="button" onClick={dict.listening ? dict.stop : dict.start}
                className={cn('press inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium',
                  dict.listening ? 'animate-pulse bg-[#ff3b30] text-white' : 'bg-accent-500/10 text-accent-700 dark:text-accent-300')}>
                {dict.listening ? <><MicOff className="size-4" />Parar</> : <><Mic className="size-4" />Falar</>}
              </button>
            )}
          </div>
          <textarea className={cn(textareaCls, 'min-h-[140px] resize-y')} value={solution} onChange={e => setSolution(e.target.value)}
            placeholder={'Ex.: Limpei o cabeçote com álcool isopropílico e recalibrei a mídia segurando o botão FEED por 2 segundos.\n\nDica: escreva um passo por linha (1. 2. 3.) que vira passo a passo automaticamente.'} />
          <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-neutral-500">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {dict.supported ? 'Toque em “Falar” e dite a solução.' : 'Para ditar, toque no ícone de microfone do teclado do celular.'}
            {dict.error && dict.error !== 'aborted' && ' (Não foi possível usar o microfone — verifique a permissão.)'}
          </p>
        </div>

        <div>
          <label className={labelCls}>3. Foto (opcional)</label>
          <div className="flex flex-wrap gap-2">
            {photos.map(p => (
              <div key={p.key} className="group relative size-20 overflow-hidden rounded-[10px] bg-neutral-100 dark:bg-neutral-800">
                <img src={p.url} alt="" className="size-full object-cover" />
                <button type="button" onClick={() => setAnnot({ key: p.key, file: p.file })} className="absolute bottom-1 left-1 grid size-6 place-items-center rounded-full bg-black/60 text-white" title="Marcar com setas"><PenTool className="size-3" /></button>
                <button type="button" onClick={() => setPhotos(ph => ph.filter(x => x.key !== p.key))} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white" aria-label="Remover foto"><X className="size-3.5" /></button>
              </div>
            ))}
            {photos.length < 4 && <>
              <button type="button" onClick={() => camRef.current?.click()} className="press grid size-20 place-items-center rounded-[10px] border border-dashed border-neutral-300 text-neutral-500 dark:border-neutral-700">
                <span className="flex flex-col items-center gap-1 text-[11px]"><Camera className="size-5" />Câmera</span>
              </button>
              <button type="button" onClick={() => galRef.current?.click()} className="press grid size-20 place-items-center rounded-[10px] border border-dashed border-neutral-300 text-neutral-500 dark:border-neutral-700">
                <span className="flex flex-col items-center gap-1 text-[11px]"><ImagePlus className="size-5" />Galeria</span>
              </button>
            </>}
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />
          <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />
        </div>

        <div>
          <label className={labelCls}>4. Assunto (opcional)</label>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {cats.map(c => (
              <button key={c.id} type="button" onClick={() => setCat(cat === c.id ? '' : c.id)}
                className={cn('press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium',
                  cat === c.id ? 'text-white' : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300')}
                style={cat === c.id ? { background: c.color } : undefined}>
                <CategoryIcon name={c.icon} className="size-3.5" />{c.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="material pb-safe fixed inset-x-0 bottom-0 z-30 shadow-[0_-0.5px_0_rgb(0_0_0/0.15)] sm:static sm:bg-transparent sm:shadow-none sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-xl gap-2 p-3 sm:p-0">
          <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => nav('/novo', { state: { problem, solution } })}>Tutorial completo</Button>
          <Button className="h-11 flex-[2] bg-brand-orange text-[16px] font-semibold hover:bg-brand-orange-dark dark:bg-brand-orange" loading={busy} onClick={publish}>
            <Send className="size-4" />Publicar dica
          </Button>
        </div>
      </div>

      {annot && (
        <Suspense fallback={null}>
          <Annotator source={annot.file} onCancel={() => setAnnot(null)} onDone={file => {
            setPhotos(ph => ph.map(p => p.key === annot.key ? (URL.revokeObjectURL(p.url), { key: p.key, file, url: URL.createObjectURL(file) }) : p))
            setAnnot(null)
          }} />
        </Suspense>
      )}
    </div>
  )
}
