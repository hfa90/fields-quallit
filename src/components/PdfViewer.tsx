import { useEffect, useRef, useState } from 'react'
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react'

type PDFDoc = { numPages: number; getPage: (n: number) => Promise<PDFPage>; destroy: () => void }
type PDFPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number }
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; transform?: number[] }) => { promise: Promise<void>; cancel: () => void }
}

/**
 * Leitor de PDF próprio (pdf.js): funciona igual no Chrome, Safari, Android e iPhone,
 * mostrando todas as páginas — o <iframe> do navegador não exibe PDF no Android.
 */
export default function PdfViewer({ url }: { url: string }) {
  const [doc, setDoc] = useState<PDFDoc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    let loaded: PDFDoc | null = null
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
        pdfjs.GlobalWorkerOptions.workerSrc = worker
        loaded = (await pdfjs.getDocument({ url }).promise) as unknown as PDFDoc
        if (alive) setDoc(loaded)
      } catch (e) {
        console.error(e)
        if (alive) setError('Não foi possível abrir o PDF aqui. Use “Baixar” ou “Abrir em nova aba”.')
      }
    })()
    return () => { alive = false; loaded?.destroy() }
  }, [url])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth - 24))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="relative">
      <div ref={box} className="allow-pan h-[70vh] overflow-auto rounded-xl bg-neutral-200/70 p-3 dark:bg-neutral-800">
        {error ? <p className="p-6 text-center text-[15px] text-neutral-600 dark:text-neutral-300">{error}</p>
          : !doc || !width ? <div className="grid h-full place-items-center"><Loader2 className="size-7 animate-spin text-neutral-400" /></div>
          : <div className="mx-auto flex flex-col items-center gap-3" style={{ width: width * zoom }}>
              {Array.from({ length: doc.numPages }, (_, i) => <Page key={i} doc={doc} n={i + 1} width={width * zoom} />)}
            </div>}
      </div>
      {doc && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-900/80 px-2 py-1 text-[13px] text-white shadow-lg backdrop-blur">
          <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="grid size-8 place-items-center rounded-full hover:bg-white/15" aria-label="Diminuir zoom"><ZoomOut className="size-4" /></button>
          <span className="w-20 text-center tabular-nums">{doc.numPages} pág. · {Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))} className="grid size-8 place-items-center rounded-full hover:bg-white/15" aria-label="Aumentar zoom"><ZoomIn className="size-4" /></button>
        </div>
      )}
    </div>
  )
}

/** Cada página só é desenhada quando aparece na tela */
function Page({ doc, n, width }: { doc: PDFDoc; n: number; width: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(n <= 2)
  const [ratio, setRatio] = useState(1.414)

  useEffect(() => {
    const el = wrap.current
    if (!el || visible) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible || !width) return
    let task: { cancel: () => void } | null = null
    let alive = true
    doc.getPage(n).then(page => {
      if (!alive || !canvas.current) return
      const base = page.getViewport({ scale: 1 })
      setRatio(base.height / base.width)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const vp = page.getViewport({ scale: width / base.width })
      const c = canvas.current
      c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr)
      c.style.width = `${vp.width}px`; c.style.height = `${vp.height}px`
      const t = page.render({ canvasContext: c.getContext('2d')!, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined })
      task = t
      t.promise.catch(() => { /* cancelado */ })
    })
    return () => { alive = false; task?.cancel() }
  }, [doc, n, width, visible])

  return (
    <div ref={wrap} className="overflow-hidden rounded-[4px] bg-white shadow-md" style={{ width, minHeight: width * ratio }}>
      <canvas ref={canvas} className="block" />
    </div>
  )
}
