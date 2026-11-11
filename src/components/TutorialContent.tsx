import { useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { X } from 'lucide-react'
import { Portal } from './ui'
import { lowlight, CALLOUTS, type CalloutType } from './editor/shared'

export interface Heading { id: string; text: string; level: number }

const YT = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\//

DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName === 'iframe') {
    const src = (node as Element).getAttribute('src') || ''
    if (!YT.test(src)) node.parentNode?.removeChild(node)
  }
})
const MEDIA = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//
DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'VIDEO') {
    if (!MEDIA.test(node.getAttribute('src') || '')) { node.parentNode?.removeChild(node); return }
    node.setAttribute('controls', ''); node.setAttribute('playsinline', ''); node.setAttribute('preload', 'metadata')
  }
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer nofollow')
  }
})

function sanitize(html: string) {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['controls', 'playsinline', 'preload', 'allowfullscreen', 'frameborder', 'allow', 'data-callout', 'data-type', 'data-checked', 'data-youtube-video', 'colspan', 'rowspan', 'colwidth', 'target', 'start'],
  })
}

type HastNode = { type: string; value?: string; tagName?: string; properties?: { className?: string[] }; children?: HastNode[] }
function hastToDom(node: HastNode, parent: Node) {
  if (node.type === 'text') { parent.appendChild(document.createTextNode(node.value ?? '')); return }
  if (node.type === 'element') {
    const el = document.createElement(node.tagName || 'span')
    if (node.properties?.className) el.className = node.properties.className.join(' ')
    node.children?.forEach(c => hastToDom(c, el))
    parent.appendChild(el)
    return
  }
  node.children?.forEach(c => hastToDom(c, parent))
}

function slugify(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'secao'
}

export default function TutorialContent({ html, onHeadings }: { html: string; onHeadings?: (h: Heading[]) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const clean = useMemo(() => sanitize(html), [html])
  const [zoom, setZoom] = useState<string | null>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    // 1) Títulos com âncora + índice
    const used = new Set<string>()
    const heads: Heading[] = []
    root.querySelectorAll('h1, h2, h3').forEach(h => {
      const text = h.textContent?.trim() || ''
      if (!text) return
      let id = slugify(text); let i = 2
      while (used.has(id)) id = `${slugify(text)}-${i++}`
      used.add(id); h.id = id
      heads.push({ id, text, level: Number(h.tagName[1]) })
    })
    onHeadings?.(heads)

    // 2) Blocos de código: realce de sintaxe + cabeçalho com botão copiar
    root.querySelectorAll('pre').forEach(pre => {
      if (pre.parentElement?.classList.contains('code-wrap')) return
      const code = pre.querySelector('code')
      const text = code?.textContent ?? pre.textContent ?? ''
      const lang = (code?.className.match(/language-([\w-]+)/)?.[1]) || 'plaintext'
      if (code && lang !== 'plaintext' && lowlight.registered(lang)) {
        try {
          const tree = lowlight.highlight(lang, text) as unknown as HastNode
          code.textContent = ''
          hastToDom(tree, code)
          code.classList.add('hljs')
        } catch { /* mantém texto puro */ }
      }
      const wrap = document.createElement('div'); wrap.className = 'code-wrap'
      const bar = document.createElement('div'); bar.className = 'code-bar'
      const label = document.createElement('span'); label.textContent = lang === 'plaintext' ? 'texto' : lang
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'code-copy'; btn.textContent = 'Copiar'
      btn.onclick = async () => {
        try { await navigator.clipboard.writeText(text); btn.textContent = 'Copiado ✓'; btn.classList.add('ok') }
        catch { btn.textContent = 'Falhou' }
        setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('ok') }, 1800)
      }
      bar.append(label, btn)
      pre.replaceWith(wrap); wrap.append(bar, pre)
    })

    // 3) Caixas de destaque ganham título automático
    root.querySelectorAll<HTMLElement>('div[data-callout]').forEach(c => {
      if (c.querySelector(':scope > .callout-title')) return
      const t = (c.dataset.callout || 'info') as CalloutType
      const meta = CALLOUTS[t] ?? CALLOUTS.info
      const title = document.createElement('div'); title.className = 'callout-title'
      title.textContent = meta.label
      c.classList.add('callout', `callout-${t}`)
      c.prepend(title)
    })

    // 4) Checklists interativos para quem lê (não salva)
    root.querySelectorAll<HTMLInputElement>('ul[data-type="taskList"] input[type="checkbox"]').forEach(i => {
      i.disabled = false
      i.onchange = () => i.closest('li')?.setAttribute('data-checked', String(i.checked))
    })

    // 5) Tabelas com rolagem horizontal no celular
    root.querySelectorAll('table').forEach(t => {
      if (t.parentElement?.classList.contains('table-wrap')) return
      const w = document.createElement('div'); w.className = 'table-wrap'
      t.replaceWith(w); w.append(t)
    })

    // 6) Zoom nas imagens
    root.querySelectorAll<HTMLImageElement>('img').forEach(img => {
      img.style.cursor = 'zoom-in'
      img.onclick = () => setZoom(img.src)
    })
  }, [clean, onHeadings])

  return (
    <>
      <div ref={ref} className="tutorial-content" dangerouslySetInnerHTML={{ __html: clean }} />
      {zoom && (<Portal>
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-950/85 p-4 backdrop-blur" onClick={() => setZoom(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Fechar"><X className="size-6" /></button>
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-lg shadow-2xl pop-in" />
        </div>
      </Portal>)}
    </>
  )
}
