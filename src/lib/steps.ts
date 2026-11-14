/** Um passo do modo "seguindo o tutorial" */
export interface Step {
  /** título da seção em que o passo está (ex.: "Passo a passo", "Pré-requisitos") */
  section: string
  /** HTML do passo (é higienizado de novo na hora de mostrar) */
  html: string
  /** veio de uma lista numerada (1. 2. 3.) */
  numbered: boolean
  /** número do passo dentro da lista numerada (para "Passo 3") */
  n?: number
}

const hasContent = (html: string) =>
  !!html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() || /<(img|pre|video|iframe|table)\b/i.test(html)

/**
 * Divide o tutorial em passos para seguir um de cada vez:
 * - cada item de lista numerada vira um passo (o que vem logo depois, como código, print ou aviso, vai junto);
 * - o resto de cada seção (objetivo, pré-requisitos, validação…) vira um cartão próprio.
 */
export function extractSteps(html: string): Step[] {
  if (typeof DOMParser === 'undefined' || !html) return []
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return []

  const steps: Step[] = []
  let section = ''
  let chunk: string[] = []
  let afterList = false // o último passo veio de uma lista numerada nesta seção
  let num = 0

  const flush = () => {
    const h = chunk.join('')
    if (hasContent(h)) steps.push({ section, html: h, numbered: false })
    chunk = []
  }

  root.childNodes.forEach(node => {
    if (node.nodeType === 3) { // texto solto
      const t = node.textContent?.trim()
      if (t) (afterList ? (steps[steps.length - 1].html += `<p>${t}</p>`) : chunk.push(`<p>${t}</p>`))
      return
    }
    if (node.nodeType !== 1) return
    const el = node as HTMLElement
    const tag = el.tagName
    if (/^H[1-3]$/.test(tag)) {
      flush(); afterList = false; num = 0
      section = el.textContent?.trim() || ''
      return
    }
    if (tag === 'OL') {
      flush()
      const start = Number(el.getAttribute('start')) || 1
      if (!afterList) num = start - 1
      Array.from(el.children).filter(li => li.tagName === 'LI').forEach(li => {
        if (hasContent(li.innerHTML)) steps.push({ section, html: li.innerHTML, numbered: true, n: ++num })
      })
      afterList = true
      return
    }
    if (afterList && steps.length) { steps[steps.length - 1].html += el.outerHTML; return }
    chunk.push(el.outerHTML)
  })
  flush()
  return steps
}

/** Vale a pena oferecer o modo passo a passo? (pelo menos 2 passos e alguma lista numerada) */
export function worthStepMode(steps: Step[]) {
  return steps.length >= 2 && steps.some(s => s.numbered)
}
