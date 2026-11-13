import { useEffect, useState } from 'react'
import { supabase, ATTACHMENTS_BUCKET } from './supabase'
import type { Attachment, Category, LinkItem, Profile, Tutorial } from './types'

/** Tutorial completo como a tela de leitura usa */
export type FullTutorial = Tutorial & {
  author: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'> | null
  editor: Pick<Profile, 'full_name'> | null
  verifier?: Pick<Profile, 'full_name'> | null
  category: Category | null
}
export interface OfflineBundle {
  id: string
  short_code: string
  title: string
  tutorial: FullTutorial
  links: LinkItem[]
  files: Attachment[]
  savedAt: string
  bytes: number
}

export const FULL_SELECT = '*, author:kb_profiles!kb_tutorials_author_id_fkey(id,full_name,email,avatar_url), editor:kb_profiles!kb_tutorials_updated_by_fkey(full_name), verifier:kb_profiles!kb_tutorials_verified_by_fkey(full_name), category:kb_categories(*)'
const MEDIA_CACHE = 'fq-offline-media'
const attKey = (id: string) => `${location.origin}${import.meta.env.BASE_URL}__offline__/att/${id}`

// ---------- IndexedDB mínimo ----------
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('fq-offline', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('tutorials', { keyPath: 'id' })
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((res, rej) => {
    const req = fn(d.transaction('tutorials', mode).objectStore('tutorials'))
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}
export const listOffline = () => tx<OfflineBundle[]>('readonly', s => s.getAll()).catch(() => [] as OfflineBundle[])
export const getOfflineById = (id: string) => tx<OfflineBundle | undefined>('readonly', s => s.get(id)).catch(() => undefined)
export async function getOfflineByCode(code: string) { return (await listOffline()).find(b => b.short_code === code) }

const listeners = new Set<() => void>()
const changed = () => listeners.forEach(l => l())

function mediaUrls(html: string, extra: (string | null | undefined)[]) {
  const urls = new Set<string>()
  for (const m of html.matchAll(/<(?:img|video)[^>]+src="([^"]+)"/g)) urls.add(m[1].replace(/&amp;/g, '&'))
  extra.forEach(u => u && urls.add(u))
  return [...urls].filter(u => /^https:\/\//.test(u))
}

/** Baixa tudo do tutorial para o aparelho */
export async function saveOffline(code: string, onProgress?: (s: string) => void): Promise<OfflineBundle> {
  const { data: t, error } = await supabase.from('kb_tutorials').select(FULL_SELECT).eq('short_code', code).single()
  if (error) throw error
  const tut = t as FullTutorial
  const [l, a] = await Promise.all([
    supabase.from('kb_links').select('*').eq('tutorial_id', tut.id).order('sort_order'),
    supabase.from('kb_attachments').select('*').eq('tutorial_id', tut.id).order('created_at'),
  ])
  const files = (a.data ?? []) as Attachment[]
  const cache = await caches.open(MEDIA_CACHE)
  let bytes = 0
  const media = mediaUrls(tut.content_html, [tut.author?.avatar_url])
  for (let i = 0; i < media.length; i++) {
    onProgress?.(`Imagens e vídeos ${i + 1}/${media.length}`)
    try { const r = await fetch(media[i], { mode: 'cors' }); if (r.ok) { bytes += Number(r.headers.get('content-length') || 0); await cache.put(media[i], r) } } catch { /* segue */ }
  }
  for (let i = 0; i < files.length; i++) {
    onProgress?.(`Anexos ${i + 1}/${files.length}`)
    const { data: s } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(files[i].storage_path, 600)
    if (!s) continue
    try {
      const r = await fetch(s.signedUrl)
      if (r.ok) {
        const blob = await r.blob(); bytes += blob.size
        await cache.put(attKey(files[i].id), new Response(blob, { headers: { 'Content-Type': files[i].mime_type || blob.type || 'application/octet-stream' } }))
      }
    } catch { /* segue */ }
  }
  bytes += new Blob([tut.content_html]).size
  const bundle: OfflineBundle = { id: tut.id, short_code: tut.short_code, title: tut.title, tutorial: tut, links: (l.data ?? []) as LinkItem[], files, savedAt: new Date().toISOString(), bytes }
  await tx('readwrite', s => s.put(bundle))
  changed()
  return bundle
}

export async function removeOffline(id: string) {
  const b = await getOfflineById(id)
  if (b) {
    const cache = await caches.open(MEDIA_CACHE)
    // remove só a mídia que nenhum outro tutorial offline usa
    const others = (await listOffline()).filter(x => x.id !== id)
    const keep = new Set(others.flatMap(o => mediaUrls(o.tutorial.content_html, [o.tutorial.author?.avatar_url])))
    for (const u of mediaUrls(b.tutorial.content_html, [b.tutorial.author?.avatar_url])) if (!keep.has(u)) await cache.delete(u)
    for (const f of b.files) await cache.delete(attKey(f.id))
  }
  await tx('readwrite', s => s.delete(id))
  changed()
}

/** URL local (blob) do anexo salvo offline, se houver */
export async function offlineAttachmentUrl(id: string) {
  try {
    const r = await (await caches.open(MEDIA_CACHE)).match(attKey(id))
    return r ? URL.createObjectURL(await r.blob()) : null
  } catch { return null }
}

/** Atualiza cópias offline que mudaram no servidor (roda ao abrir o app com internet) */
let refreshed = false
export async function refreshOffline() {
  if (refreshed || !navigator.onLine) return
  refreshed = true
  const all = await listOffline()
  if (!all.length) return
  const { data } = await supabase.from('kb_tutorials').select('id,short_code,updated_at').in('id', all.map(b => b.id))
  for (const b of all) {
    const cur = data?.find(d => d.id === b.id)
    if (!cur) { await removeOffline(b.id); continue }  // excluído ou sem acesso
    if (cur.updated_at !== b.tutorial.updated_at) { try { await saveOffline(cur.short_code) } catch { /* tenta depois */ } }
  }
}

export function useOfflineIds() {
  const [ids, setIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    const load = () => listOffline().then(l => setIds(new Set(l.map(b => b.id))))
    load(); listeners.add(load)
    return () => { listeners.delete(load) }
  }, [])
  return ids
}

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine)
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return on
}

export const isNetworkError = (e: unknown) =>
  !navigator.onLine || /fetch|network|Failed to fetch|NetworkError|Load failed/i.test(String((e as { message?: string })?.message ?? e))
