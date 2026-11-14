import { createLowlight, common } from 'lowlight'

/** Realce de sintaxe (~37 linguagens). Pesado: na leitura é carregado sob demanda, só quando há código. */
export const lowlight = createLowlight(common)

export { CALLOUTS, type CalloutType } from './callouts'
