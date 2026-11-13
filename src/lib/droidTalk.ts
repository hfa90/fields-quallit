/**
 * Falas do robozinho do login.
 * Quem já entrou neste aparelho fica lembrado (só primeiro nome e estado do CD, guardados no próprio aparelho),
 * para o robô cumprimentar com uma gíria da terra da pessoa. Nada é consultado no servidor antes do login.
 */

/** Saudação com sotaque de cada estado ({n} = primeiro nome) */
export const SLANG: Record<string, string[]> = {
  AC: ['Égua, {n}! Tu por aqui de novo, maninho?', 'Ei, {n}! Tá de boa, parceiro?'],
  AL: ['Ôxe, {n}! Que bom te ver, visse?', 'Eita, {n}, meu bichinho! Chegou foi?'],
  AP: ['Égua, {n}! Tu de novo, maninho? Que massa!', 'Ei, {n}, pai d’égua te ver!'],
  AM: ['Égua, {n}! Tu por aqui, é de rocha? 😄', 'Ei, mano {n}! Chegou foi?'],
  BA: ['Ó paí, ó! Meu rei {n}, quanto tempo!', 'Ôxe, {n}! Tá de boa, meu rei?'],
  CE: ['Ôxe, macho véi! {n} por aqui!', 'Ei, {n}, tu é arretado demais, macho!'],
  DF: ['Ô véi, {n}! Que massa te ver!', 'Fala, {n}! De boa, véi?'],
  ES: ['Ô {n}, tô pocando de alegria de te ver!', 'Fala, {n}! Tudo nos conformes, capixaba?'],
  GO: ['Ô {n}, cê tá bão? Que trem bom, uai!', 'Eita, {n}! Bora que bora, sô!'],
  MA: ['Ei, mah, {n}! Tudo nos conformes?', 'Égua, {n}! Tu voltou, foi?'],
  MT: ['Tchá por Deus, {n}! Que bão te ver!', 'Ôh, {n}! Chegou, pai!'],
  MS: ['E aí, piá {n}! Bora um tereré?', 'Ô loco, {n}! Que bão te ver, piá!'],
  MG: ['Uai, sô! {n}, que trem bão te ver!', 'Ô {n}, cê sumiu, uai! Bão demais da conta!'],
  PA: ['Égua, {n}! Pai d’égua te ver de novo!', 'Ei, {n}, maninho! Tá de rocha?'],
  PB: ['Ôxe, {n}! Tu voltou, foi? Visse!', 'Vixe, {n}! Que arretado te ver, painho!'],
  PR: ['E aí, piá {n}! Que legal te ver de novo!', 'Ô {n}, piá! Bora, que hoje é dia!'],
  PE: ['Ôxente, boy {n}! Arretado te ver, visse?', 'Massa, {n}! Tu chegou, foi?'],
  PI: ['Ei, macho {n}! Tu tá é bom, rapaz!', 'Ôxe, {n}! Chegou foi, macho véi?'],
  RJ: ['Caraca, {n}! Que maneiro te ver, mermão!', 'Fala, {n}! Tá suave? Partiu!'],
  RN: ['Ôxe, boy {n}! Tá arretado hoje, é?', 'Eita, {n}! Que massa te ver, visse?'],
  RS: ['Bah, tchê {n}! Mas que barbaridade, tu por aqui!', 'Bah, {n}! Tri bom te ver, guri!'],
  RO: ['Firmeza, {n}? Que bom te ver, irmão!', 'Ô {n}, chegou chegando, hein!'],
  RR: ['Ei, parente {n}! Bora que bora!', 'Égua, {n}! Tu por aqui, maninho?'],
  SC: ['Ó-lhó-lhó, {n}! Tás bem, mô quiridu?', 'Ô {n}, tás tolo? Que bom te ver!'],
  SP: ['Ô meu, {n}! Que da hora te ver aqui!', 'E aí, {n}, beleza, mano? Sussa?'],
  SE: ['Ôxe, {n}! Tá é bom, viu? Que saudade!', 'Eita, {n}! Chegou foi, meu filho?'],
  TO: ['Ôh, {n}! Tá danado de bom te ver!', 'Eita, {n}! Que bão, sô!'],
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

export function greeting(name: string, uf?: string | null) {
  const n = name.split(' ')[0]
  const opts = uf && SLANG[uf]
  return opts ? pick(opts).replace('{n}', n) : `Opa, ${n}! Que bom te ver!`
}

// ---------------------------------------------------------------- memória do aparelho
type Known = { name: string; uf: string | null; t: number }
const KEY = 'fq-known-users'
const norm = (e: string) => e.trim().toLowerCase()

export function recallUser(email: string): Known | null {
  try { return (JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, Known>)[norm(email)] ?? null } catch { return null }
}

export function rememberUser(email: string, name: string | null, uf: string | null) {
  if (!email || !name) return
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, Known>
    all[norm(email)] = { name: name.split(' ')[0], uf, t: Date.now() }
    // guarda no máximo 8 pessoas por aparelho
    const keep = Object.entries(all).sort((a, b) => b[1].t - a[1].t).slice(0, 8)
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(keep)))
  } catch { /* ignore */ }
}
