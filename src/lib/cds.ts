import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { UF_NAME } from './brStates'

/** CD do Inventário (origem 'inventario') ou local criado na central (origem 'fields') */
export interface CD { id: string; codigo: string | null; nome: string; cidade: string | null; uf: string | null; origem?: 'inventario' | 'fields' }

let cache: CD[] | null = null
const listeners = new Set<(c: CD[]) => void>()
let loading: Promise<void> | null = null

function load() {
  loading ??= Promise.resolve(supabase.rpc('kb_list_cds')).then(({ data, error }) => {
    loading = null
    if (error || !data) return // não guarda falha: tenta de novo na próxima tela
    cache = data as CD[]
    listeners.forEach(fn => fn(cache!))
  })
  return loading
}

/** Recarrega a lista (ex.: depois de criar um local novo) */
export function refreshCds() { cache = null; return load() }

/** CDs cadastrados no Inventário + locais criados na central */
export function useCds() {
  const [cds, setCds] = useState<CD[]>(cache ?? [])
  useEffect(() => {
    listeners.add(setCds)
    if (!cache) load(); else setCds(cache)
    return () => { listeners.delete(setCds) }
  }, [])
  return cds
}

/** Descobre a UF de um CD pelo nome (usa o cadastro de CDs) */
export function useCdUf() {
  const cds = useCds()
  return (name?: string | null) => (name ? cds.find(c => c.nome === name)?.uf ?? null : null)
}

/** "CD RIO DE JANEIRO" -> "Rio de Janeiro" (nome curto para etiquetas) */
export function cdShort(name?: string | null) {
  if (!name) return ''
  const n = name.replace(/^CD\s+/i, '').toLowerCase()
  return n.replace(/(^|\s)(\p{L})/gu, (_m, s, c) => s + c.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, w => w.toLowerCase())
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const UFS = Object.entries(UF_NAME).map(([uf, nome]) => ({ uf, nome, n: norm(nome) }))

/** Estados que combinam com o que foi digitado (sigla ou nome, sem acento) — o melhor primeiro */
export function matchUf(text: string) {
  const q = norm(text)
  if (!q) return []
  const score = (s: { uf: string; n: string }) =>
    s.uf.toLowerCase() === q ? 0 : s.n === q ? 0 : s.n.startsWith(q) ? 1 : s.n.split(' ').some(w => w.length > 2 && w.startsWith(q)) ? 2 : s.n.includes(q) && q.length >= 3 ? 3 : 9
  return UFS.map(s => ({ ...s, sc: score(s) })).filter(s => s.sc < 9).sort((a, b) => a.sc - b.sc || a.nome.localeCompare(b.nome)).map(({ uf, nome }) => ({ uf, nome }))
}

/** UF exata para o texto, quando não há dúvida (sigla, nome completo ou única opção) */
export function resolveUf(text: string) {
  const m = matchUf(text)
  const q = norm(text)
  if (!m.length) return null
  if (m[0].uf.toLowerCase() === q || norm(m[0].nome) === q || m.length === 1) return m[0].uf
  return null
}
