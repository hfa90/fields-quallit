import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from './supabase'
import type { TutorialListItem } from './types'
import { errMsg } from './utils'

export const LIST_COLS = 'id,short_code,title,summary,category_id,tags,difficulty,status,author_id,created_at,updated_at,author_name,author_avatar,category_name,category_color,category_icon,viewer_count,view_count,attachment_count,helpful_count,not_helpful_count,comment_count,outdated_count,review_due,reviewed_at'

// Favoritos compartilhados entre telas (cache em memória)
let favCache: Set<string> | null = null
const subs = new Set<(s: Set<string>) => void>()
const emit = () => subs.forEach(f => f(new Set(favCache!)))

export function useFavorites() {
  const [favs, setFavs] = useState<Set<string>>(favCache ?? new Set())
  useEffect(() => {
    subs.add(setFavs)
    if (!favCache) {
      supabase.from('kb_favorites').select('tutorial_id').then(({ data }) => {
        favCache = new Set((data ?? []).map(r => r.tutorial_id)); emit()
      })
    }
    return () => { subs.delete(setFavs) }
  }, [])
  const toggle = useCallback(async (id: string) => {
    if (!favCache) favCache = new Set()
    const on = !favCache.has(id)
    if (on) favCache.add(id); else favCache.delete(id)
    emit()
    const { error } = on
      ? await supabase.from('kb_favorites').insert({ tutorial_id: id })
      : await supabase.from('kb_favorites').delete().eq('tutorial_id', id)
    if (error) {
      if (on) favCache.delete(id); else favCache.add(id)
      emit(); toast.error(errMsg(error)); return
    }
    toast.success(on ? 'Adicionado aos favoritos' : 'Removido dos favoritos', { duration: 1500 })
  }, [])
  return { favs, toggle }
}

export async function fetchFavorites(): Promise<TutorialListItem[]> {
  const { data } = await supabase.from('kb_favorites').select('tutorial_id, created_at').order('created_at', { ascending: false })
  const ids = (data ?? []).map(r => r.tutorial_id)
  if (!ids.length) return []
  const { data: rows } = await supabase.from('kb_tutorials_list').select(LIST_COLS).in('id', ids)
  const byId = new Map((rows as unknown as TutorialListItem[] ?? []).map(r => [r.id, r]))
  return ids.map(id => byId.get(id)).filter(Boolean) as TutorialListItem[]
}

export async function fetchRecent(limit = 12): Promise<(TutorialListItem & { last_viewed: string })[]> {
  const { data } = await supabase.rpc('kb_my_recent', { p_limit: limit })
  const rec = (data as { tutorial_id: string; last_viewed: string }[]) ?? []
  if (!rec.length) return []
  const { data: rows } = await supabase.from('kb_tutorials_list').select(LIST_COLS).in('id', rec.map(r => r.tutorial_id))
  const byId = new Map((rows as unknown as TutorialListItem[] ?? []).map(r => [r.id, r]))
  return rec.map(r => byId.get(r.tutorial_id) && { ...byId.get(r.tutorial_id)!, last_viewed: r.last_viewed }).filter(Boolean) as (TutorialListItem & { last_viewed: string })[]
}

// Seguir categorias / pessoas
export function useFollows() {
  const [rows, setRows] = useState<{ id: string; category_id: string | null; author_id: string | null }[]>([])
  useEffect(() => {
    supabase.auth.getUser().then(({ data: u }) => {
      if (!u.user) return
      supabase.from('kb_follows').select('id,category_id,author_id').eq('user_id', u.user.id).then(({ data }) => setRows(data ?? []))
    })
  }, [])
  const isFollowing = (k: { category?: string; author?: string }) =>
    rows.some(r => (k.category && r.category_id === k.category) || (k.author && r.author_id === k.author))
  const toggle = async (k: { category?: string; author?: string }, label: string) => {
    const row = rows.find(r => (k.category && r.category_id === k.category) || (k.author && r.author_id === k.author))
    if (row) {
      setRows(rows.filter(r => r.id !== row.id))
      await supabase.from('kb_follows').delete().eq('id', row.id)
      toast(`Você deixou de seguir ${label}`)
    } else {
      const { data, error } = await supabase.from('kb_follows').insert({ category_id: k.category ?? null, author_id: k.author ?? null }).select('id,category_id,author_id').single()
      if (error) return toast.error(errMsg(error))
      setRows([...rows, data])
      toast.success(`Seguindo ${label}`, { description: 'Você será avisado quando houver novidades.' })
    }
  }
  return { isFollowing, toggle }
}
