import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface CD { id: string; codigo: string | null; nome: string; cidade: string | null; uf: string | null }

let cache: CD[] | null = null
/** CDs cadastrados no Inventário (somente leitura) */
export function useCds() {
  const [cds, setCds] = useState<CD[]>(cache ?? [])
  useEffect(() => {
    if (cache) return
    supabase.rpc('kb_list_cds').then(({ data }) => { cache = (data as CD[]) ?? []; setCds(cache) })
  }, [])
  return cds
}

/** "CD RIO DE JANEIRO" -> "Rio de Janeiro" (nome curto para etiquetas) */
export function cdShort(name?: string | null) {
  if (!name) return ''
  const n = name.replace(/^CD\s+/i, '').toLowerCase()
  return n.replace(/(^|\s)(\p{L})/gu, (_m, s, c) => s + c.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, w => w.toLowerCase())
}
