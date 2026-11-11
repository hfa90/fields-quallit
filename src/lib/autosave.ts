import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { Difficulty, LinkItem } from './types'

export interface DraftData {
  title: string
  summary: string
  categoryId: string
  difficulty: Difficulty
  tags: string[]
  links: LinkItem[]
  reviewMonths: number
  json: unknown
  html: string
  savedAt: string
}

const LOCAL_MS = 1000   // grava no aparelho 1s depois de parar de digitar
const SERVER_MS = 8000  // e na nuvem no máximo a cada 8s

const localKey = (uid: string, key: string) => `fq-draft:${uid}:${key}`

/**
 * Rascunho automático: protege contra fechar o navegador, acabar a bateria ou trocar de aparelho.
 * Não altera o tutorial publicado — só guarda uma cópia de segurança.
 */
export function useAutosave(userId: string | undefined, key: string | null) {
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'pending' | 'saved' | 'offline'>('idle')
  const getter = useRef<(() => DraftData) | null>(null)
  const localT = useRef<number | undefined>(undefined)
  const serverT = useRef<number | undefined>(undefined)
  const lastServer = useRef(0)

  const pushServer = useCallback(async () => {
    if (!userId || !key || !getter.current) return
    const data = getter.current()
    lastServer.current = Date.now()
    const { error } = await supabase.from('kb_autosaves').upsert({ user_id: userId, draft_key: key, data, updated_at: data.savedAt })
    setState(error ? 'offline' : 'saved')
  }, [userId, key])

  const schedule = useCallback((get: () => DraftData) => {
    if (!userId || !key) return
    getter.current = () => ({ ...get(), savedAt: new Date().toISOString() })
    setState('pending')
    clearTimeout(localT.current)
    localT.current = window.setTimeout(() => {
      const data = getter.current!()
      try { localStorage.setItem(localKey(userId, key), JSON.stringify(data)) } catch { /* cheio */ }
      setSavedAt(data.savedAt)
      setState(s => (s === 'pending' ? 'saved' : s))
      const wait = Math.max(0, SERVER_MS - (Date.now() - lastServer.current))
      clearTimeout(serverT.current)
      serverT.current = window.setTimeout(pushServer, wait)
    }, LOCAL_MS)
  }, [userId, key, pushServer])

  // salva imediatamente ao sair da aba / fechar
  useEffect(() => {
    const flush = () => {
      if (!getter.current || !userId || !key) return
      try { localStorage.setItem(localKey(userId, key), JSON.stringify(getter.current())) } catch { /* ignore */ }
    }
    const vis = () => { if (document.visibilityState === 'hidden') { flush(); pushServer() } }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', vis)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', vis); clearTimeout(localT.current); clearTimeout(serverT.current) }
  }, [userId, key, pushServer])

  /** Rascunho mais recente (aparelho ou nuvem) */
  const load = useCallback(async (): Promise<DraftData | null> => {
    if (!userId || !key) return null
    let local: DraftData | null = null
    try { local = JSON.parse(localStorage.getItem(localKey(userId, key)) || 'null') } catch { /* ignore */ }
    const { data } = await supabase.from('kb_autosaves').select('data').eq('user_id', userId).eq('draft_key', key).maybeSingle()
    const remote = (data?.data as DraftData | undefined) ?? null
    if (local && remote) return local.savedAt >= remote.savedAt ? local : remote
    return local ?? remote
  }, [userId, key])

  const clear = useCallback(async (k = key) => {
    clearTimeout(localT.current); clearTimeout(serverT.current)
    getter.current = null
    if (!userId || !k) return
    try { localStorage.removeItem(localKey(userId, k)) } catch { /* ignore */ }
    await supabase.from('kb_autosaves').delete().eq('user_id', userId).eq('draft_key', k)
    setState('idle'); setSavedAt(null)
  }, [userId, key])

  return { schedule, load, clear, savedAt, state }
}
