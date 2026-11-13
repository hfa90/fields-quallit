import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

type Stamped = { v: string; t: number }
const localKey = (uid: string, key: string) => `fq-pref:${uid}:${key}`

function readLocal(uid: string | undefined, key: string): Stamped | null {
  if (!uid) return null
  try { const s = JSON.parse(localStorage.getItem(localKey(uid, key)) || 'null'); return s && typeof s.v === 'string' ? s : null } catch { return null }
}

/**
 * Preferência pessoal lembrada entre visitas.
 * Fica no aparelho (abre na hora) e na conta (vale no site e no app);
 * vence sempre a escolha mais recente.
 */
export function usePref<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (v: T) => void] {
  const { profile } = useAuth()
  const uid = profile?.id
  const valid = (v: unknown): v is T => typeof v === 'string' && (allowed as readonly string[]).includes(v)
  const server = profile?.prefs?.[key]

  const pick = () => {
    const local = readLocal(uid, key)
    const best = [local, server].filter((s): s is Stamped => !!s && valid(s.v)).sort((a, b) => b.t - a.t)[0]
    return (best?.v as T) ?? fallback
  }
  const [value, setValue] = useState<T>(pick)

  // quando o perfil chega (ou muda de conta), adota a escolha mais recente
  useEffect(() => {
    const v = pick()
    setValue(v)
    const local = readLocal(uid, key)
    if (uid && server && valid(server.v) && (!local || server.t > local.t)) {
      try { localStorage.setItem(localKey(uid, key), JSON.stringify(server)) } catch { /* ignore */ }
    }
  }, [uid, server?.t])

  const set = (v: T) => {
    setValue(v)
    if (!uid) return
    const stamped: Stamped = { v, t: Date.now() }
    try { localStorage.setItem(localKey(uid, key), JSON.stringify(stamped)) } catch { /* ignore */ }
    supabase.rpc('kb_set_pref', { p_key: key, p_value: stamped }).then(({ data, error }) => {
      if (error) return // sem internet: fica salvo no aparelho
      try { // mantém o perfil guardado (modo offline) em dia
        const ck = `fq-profile:${uid}`
        const cached = JSON.parse(localStorage.getItem(ck) || 'null')
        if (cached) localStorage.setItem(ck, JSON.stringify({ ...cached, prefs: data }))
      } catch { /* ignore */ }
    })
  }
  return [value, set]
}
