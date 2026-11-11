import { uploadImage } from './upload'

export interface ImportResult { html: string; title?: string; images: number; pages?: number }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const baseName = (n: string) => n.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()

/** Word (.docx) -> HTML do editor. Imagens do documento são enviadas para o Storage. */
async function fromDocx(file: File, userId: string, onStep: (s: string) => void): Promise<ImportResult> {
  // @ts-expect-error build de navegador sem tipos
  const mammoth = (await import('mammoth/mammoth.browser.js')).default
  let images = 0
  const res = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, {
    styleMap: [
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Título'] => h1:fresh",
      "p[style-name='Subtitle'] => h2:fresh",
      "p[style-name='Heading 1'] => h2:fresh",
      "p[style-name='Título 1'] => h2:fresh",
      "p[style-name='Heading 2'] => h3:fresh",
      "p[style-name='Título 2'] => h3:fresh",
      "p[style-name='Heading 3'] => h4:fresh",
      "p[style-name='Título 3'] => h4:fresh",
      "p[style-name='Quote'] => blockquote:fresh",
      "p[style-name='Citação'] => blockquote:fresh",
    ],
    convertImage: mammoth.images.imgElement(async (img: { contentType: string; read: (enc: string) => Promise<string> }) => {
      images++
      onStep(`Enviando imagem ${images} do documento…`)
      const b64 = await img.read('base64')
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      const ext = img.contentType.split('/')[1] || 'png'
      const src = await uploadImage(new File([bin], `word-${images}.${ext}`, { type: img.contentType }), userId)
      return { src }
    }),
  })
  let html: string = res.value
  // Word costuma usar "Normal" com negrito como título: transforma parágrafo curto 100% negrito em h3
  html = html.replace(/<p><strong>([^<]{3,80})<\/strong><\/p>/g, '<h3>$1</h3>')
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const title = doc.querySelector('h1')?.textContent?.trim() || baseName(file.name)
  doc.querySelector('h1')?.remove()
  return { html: doc.body.innerHTML, title, images }
}

/** PDF -> HTML: reconstrói parágrafos, títulos (pelo tamanho da fonte), listas e numeração. */
async function fromPdf(file: File, onStep: (s: string) => void): Promise<ImportResult> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise

  type Line = { y: number; h: number; text: string; page: number }
  const lines: Line[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    onStep(`Lendo página ${p} de ${pdf.numPages}…`)
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    const rows = new Map<number, { x: number; h: number; s: string }[]>()
    for (const it of tc.items as { str: string; transform: number[]; height: number }[]) {
      if (!it.str.trim()) continue
      const y = Math.round(it.transform[5])
      const key = [...rows.keys()].find(k => Math.abs(k - y) <= 2) ?? y
      rows.set(key, [...(rows.get(key) ?? []), { x: it.transform[4], h: it.height || Math.abs(it.transform[3]), s: it.str }])
    }
    ;[...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([y, parts]) => {
      parts.sort((a, b) => a.x - b.x)
      const text = parts.map(p => p.s).join(' ').replace(/\s+/g, ' ').trim()
      if (text && !/^\d+$/.test(text)) lines.push({ y, h: Math.max(...parts.map(p => p.h)), text, page: p })
    })
  }
  if (!lines.length) throw new Error('Este PDF não tem texto selecionável (provavelmente é digitalizado). Anexe o arquivo ao tutorial.')

  const sizes = lines.map(l => l.h).sort((a, b) => a - b)
  const body = sizes[Math.floor(sizes.length / 2)] || 10
  const out: string[] = []
  let para: string[] = []
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null
  const flushPara = () => { if (para.length) { out.push(`<p>${esc(para.join(' '))}</p>`); para = [] } }
  const flushList = () => { if (list) { out.push(`<${list.type}>${list.items.map(i => `<li><p>${esc(i)}</p></li>`).join('')}</${list.type}>`); list = null } }
  let title: string | undefined

  lines.forEach((l, i) => {
    const prev = lines[i - 1]
    const gap = prev && prev.page === l.page ? prev.y - l.y : Infinity
    const bullet = l.text.match(/^[•●▪◦\-–*]\s+(.*)/)
    const num = l.text.match(/^(\d{1,2})[.)]\s+(.*)/)
    if (l.h >= body * 1.25 && l.text.length < 120) {
      flushPara(); flushList()
      if (!title && l.h >= body * 1.5) { title = l.text; return }
      out.push(l.h >= body * 1.5 ? `<h2>${esc(l.text)}</h2>` : `<h3>${esc(l.text)}</h3>`)
    } else if (bullet || num) {
      flushPara()
      const type = bullet ? 'ul' : 'ol'
      if (!list || list.type !== type) { flushList(); list = { type, items: [] } }
      list.items.push((bullet ? bullet[1] : num![2]).trim())
    } else if (list && gap < body * 1.6 && !/[.:;!?]$/.test(list.items[list.items.length - 1])) {
      list.items[list.items.length - 1] += ' ' + l.text // continuação do item
    } else {
      flushList()
      if (gap > body * 1.7) flushPara()
      para.push(l.text)
      if (/[.:!?]$/.test(l.text) && l.text.length < 60) flushPara()
    }
  })
  flushPara(); flushList()
  return { html: out.join('\n'), title: title || baseName(file.name), images: 0, pages: pdf.numPages }
}

export async function importDocument(file: File, userId: string, onStep: (s: string) => void): Promise<ImportResult> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'docx') return fromDocx(file, userId, onStep)
  if (ext === 'pdf' || file.type === 'application/pdf') return fromPdf(file, onStep)
  if (ext === 'doc') throw new Error('Formato .doc antigo não é suportado. Abra no Word e salve como .docx.')
  throw new Error('Envie um arquivo .docx ou .pdf')
}
