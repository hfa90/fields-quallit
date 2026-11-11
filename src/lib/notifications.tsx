import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { Notification } from './types'

interface Ctx {
  items: Notification[]
  unread: number
  loading: boolean
  markRead: (id?: number) => Promise<void>
  remove: (id: number) => Promise<void>
  reload: () => Promise<void>
}
const NotifCtx = createContext<Ctx | null>(null)

export function NotificationsProvider({ children, onOpen }: { children: ReactNode; onOpen: (link: string) => void }) {
  const { profile, isMember } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!profile || !isMember) return
    const { data } = await supabase.from('kb_notifications').select('*').order('created_at', { ascending: false }).limit(60)
    setItems((data as Notification[]) ?? [])
    setLoading(false)
  }, [profile, isMember])

  useEffect(() => { reload() }, [reload])

  // Tempo real: novas notificações aparecem na hora
  useEffect(() => {
    if (!profile || !isMember) return
    const ch = supabase.channel(`kb-notif-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kb_notifications', filter: `user_id=eq.${profile.id}` }, payload => {
        const n = payload.new as Notification
        setItems(prev => [n, ...prev.filter(p => p.id !== n.id)])
        toast(n.title, {
          description: n.body ?? undefined,
          action: n.link ? { label: 'Abrir', onClick: () => onOpen(n.link!) } : undefined,
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile, isMember, onOpen])

  const unread = items.filter(i => !i.read_at).length

  // Contador no ícone do app instalado
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
    try { if (unread) nav.setAppBadge?.(unread); else nav.clearAppBadge?.() } catch { /* sem suporte */ }
  }, [unread])

  const markRead = async (id?: number) => {
    const now = new Date().toISOString()
    setItems(prev => prev.map(i => (id == null || i.id === id) && !i.read_at ? { ...i, read_at: now } : i))
    let q = supabase.from('kb_notifications').update({ read_at: now }).is('read_at', null)
    if (id != null) q = q.eq('id', id)
    await q
  }
  const remove = async (id: number) => {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('kb_notifications').delete().eq('id', id)
  }

  return <NotifCtx.Provider value={{ items, unread, loading, markRead, remove, reload }}>{children}</NotifCtx.Provider>
}

export function useNotifications() {
  const c = useContext(NotifCtx)
  if (!c) throw new Error('useNotifications fora do provider')
  return c
}
