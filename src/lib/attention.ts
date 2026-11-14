import { useEffect, useState } from 'react'

/**
 * Fila de avisos: no máximo UM aviso automático (janela que abre sozinha) por acesso.
 * Quem quer aparecer se candidata; depois de um instante, vence o de maior prioridade.
 * Quem não foi escolhido continua pendente e tenta de novo no próximo acesso
 * ("acesso" = sessão da aba: recarregar a página não libera outro aviso).
 * Avisos abertos pelo próprio usuário (botões, atalhos) não passam por aqui.
 */
export type AttentionSlot = 'onboarding' | 'whatsnew' | 'achievement' | 'droid'
const PRIORITY: Record<AttentionSlot, number> = { onboarding: 0, whatsnew: 1, achievement: 2, droid: 3 }
const SESSION_KEY = 'fq-attention'
const SETTLE_MS = 1500

const wanting = new Set<AttentionSlot>()
const listeners = new Set<() => void>()
let granted: AttentionSlot | null = (() => { try { return sessionStorage.getItem(SESSION_KEY) as AttentionSlot | null } catch { return null } })()
let timer: number | undefined

function decide() {
  timer = undefined
  if (granted || !wanting.size) return
  granted = [...wanting].sort((a, b) => PRIORITY[a] - PRIORITY[b])[0]
  try { sessionStorage.setItem(SESSION_KEY, granted) } catch { /* ignore */ }
  listeners.forEach(l => l())
}

/** true quando este aviso pode abrir agora */
export function useAttention(slot: AttentionSlot, wants: boolean) {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force(n => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  useEffect(() => {
    if (!wants) { wanting.delete(slot); return }
    wanting.add(slot)
    if (!granted) { window.clearTimeout(timer); timer = window.setTimeout(decide, SETTLE_MS) }
    return () => { wanting.delete(slot) }
  }, [slot, wants])
  return wants && granted === slot
}
