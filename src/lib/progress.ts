/**
 * Onde a pessoa parou em cada tutorial (fica no aparelho).
 * - modo passo a passo: passo atual e passos marcados como feitos;
 * - leitura normal: última seção (título) alcançada.
 */
export interface Progress {
  step?: number
  total?: number
  done?: number[]
  anchor?: string
  anchorLabel?: string
  t: number
}

const key = (uid: string, code: string) => `fq-progress:${uid}:${code}`
const MAX_AGE = 45 * 864e5 // depois de 45 dias, esquece

export function getProgress(uid: string | undefined, code: string): Progress | null {
  if (!uid) return null
  try {
    const p = JSON.parse(localStorage.getItem(key(uid, code)) || 'null') as Progress | null
    if (!p || Date.now() - p.t > MAX_AGE) return null
    return p
  } catch { return null }
}

export function saveProgress(uid: string | undefined, code: string, patch: Omit<Progress, 't'>) {
  if (!uid) return
  try {
    const prev = getProgress(uid, code) ?? { t: 0 }
    localStorage.setItem(key(uid, code), JSON.stringify({ ...prev, ...patch, t: Date.now() }))
  } catch { /* ignore */ }
}

export function clearStepProgress(uid: string | undefined, code: string) {
  if (!uid) return
  const p = getProgress(uid, code)
  if (!p) return
  try {
    const { step: _s, total: _t, done: _d, ...rest } = p
    localStorage.setItem(key(uid, code), JSON.stringify({ ...rest, t: Date.now() }))
  } catch { /* ignore */ }
}

/** Texto curto para o "Continuar lendo": "Passo 4 de 9" ou "Parou em: Configuração" */
export function progressLabel(p: Progress | null) {
  if (!p) return null
  if (p.step != null && p.total) return `Parou no passo ${p.step + 1} de ${p.total}`
  if (p.anchorLabel) return `Parou em: ${p.anchorLabel}`
  return null
}

/** Ponto em que vale continuar: passo a passo não concluído, ou leitura que passou do começo */
export function hasResume(p: Progress | null) {
  return !!p && ((p.step != null && !!p.total && p.step > 0) || !!p.anchor)
}
