import { createLowlight, common } from 'lowlight'

export const lowlight = createLowlight(common)

export type CalloutType = 'info' | 'tip' | 'warning' | 'danger' | 'success'
export const CALLOUTS: Record<CalloutType, { label: string; color: string }> = {
  info: { label: 'Informação', color: '#007aff' },
  tip: { label: 'Dica', color: '#af52de' },
  warning: { label: 'Atenção', color: '#ff9500' },
  danger: { label: 'Cuidado', color: '#ff3b30' },
  success: { label: 'Resultado esperado', color: '#34c759' },
}
