/** Caminho pelo qual o usuário entrou no app (para saber se veio de um link compartilhado). */
export const entry = { path: '', consumed: false }

export function cameFromSharedLink(code: string) {
  if (entry.consumed) return false
  entry.consumed = true
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return entry.path === `${base}/t/${code}`
}
