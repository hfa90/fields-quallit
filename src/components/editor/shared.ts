import { createLowlight, common } from 'lowlight'

export const lowlight = createLowlight(common)

export type CalloutType = 'info' | 'tip' | 'warning' | 'danger' | 'success'
export const CALLOUTS: Record<CalloutType, { label: string; emoji: string }> = {
  info: { label: 'Informação', emoji: 'ℹ️' },
  tip: { label: 'Dica', emoji: '💡' },
  warning: { label: 'Atenção', emoji: '⚠️' },
  danger: { label: 'Cuidado', emoji: '⛔' },
  success: { label: 'Resultado esperado', emoji: '✅' },
}
