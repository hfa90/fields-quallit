import type { Difficulty, Role } from './types'

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  field_admin: 'Field Administrador',
  field: 'Field',
  pending: 'Aguardando aprovação',
  blocked: 'Bloqueado',
}

export const ROLE_STYLE: Record<Role, string> = {
  admin: 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300',
  field_admin: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  field: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  blocked: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
}

export const DIFFICULTY: Record<Difficulty, { label: string; style: string; dots: number }> = {
  basico: { label: 'Básico', style: 'text-emerald-600 dark:text-emerald-400', dots: 1 },
  intermediario: { label: 'Intermediário', style: 'text-amber-600 dark:text-amber-400', dots: 2 },
  avancado: { label: 'Avançado', style: 'text-rose-600 dark:text-rose-400', dots: 3 },
}

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function initials(name?: string | null, email?: string) {
  const src = (name || email || '?').trim()
  const parts = src.split(/[\s.@_-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return `hsl(${h} 65% 52%)`
}

const dtf = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })
const df = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })
export const fmtDateTime = (s: string) => dtf.format(new Date(s))
export const fmtDate = (s: string) => df.format(new Date(s))

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
export function timeAgo(s: string) {
  const diff = (new Date(s).getTime() - Date.now()) / 1000
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60],
  ]
  for (const [u, sec] of units) if (Math.abs(diff) >= sec) return rtf.format(Math.round(diff / sec), u)
  return 'agora mesmo'
}

export function fileSize(b?: number | null) {
  if (!b && b !== 0) return ''
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

export function readingTime(html: string) {
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

/** Link curto e bonito: https://dominio/base/t/AbC123 */
export function shortUrl(code: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const origin = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(window.location.origin) && (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
    ? 'https://hfa90.github.io' : window.location.origin
  return `${origin}${base}/t/${code}`
}

export function safeFileName(name: string) {
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : ''
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').slice(0, 60)
  return `${base || 'arquivo'}${ext}`
}

export type FileKind = 'pdf' | 'word' | 'powerpoint' | 'excel' | 'image' | 'video' | 'archive' | 'text' | 'other'
export function fileKind(name: string, mime?: string | null): FileKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'word'
  if (['ppt', 'pptx', 'pps', 'ppsx', 'odp'].includes(ext)) return 'powerpoint'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'excel'
  if (mime?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (mime?.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext)) return 'video'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive'
  if (['txt', 'log', 'md', 'json', 'xml', 'ps1', 'sh', 'bat', 'conf', 'ovpn', 'cfg', 'ini'].includes(ext)) return 'text'
  return 'other'
}

export const FILE_STYLE: Record<FileKind, { label: string; color: string }> = {
  pdf: { label: 'PDF', color: '#dc2626' },
  word: { label: 'Word', color: '#2563eb' },
  powerpoint: { label: 'PowerPoint', color: '#ea580c' },
  excel: { label: 'Excel', color: '#16a34a' },
  image: { label: 'Imagem', color: '#9333ea' },
  video: { label: 'Vídeo', color: '#db2777' },
  archive: { label: 'Compactado', color: '#ca8a04' },
  text: { label: 'Texto', color: '#475569' },
  other: { label: 'Arquivo', color: '#64748b' },
}

export function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export function errMsg(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

/** Nível na comunidade a partir dos pontos */
export function level(points: number) {
  if (points >= 400) return { name: 'Mentor', next: null as number | null, color: '#fe811e' }
  if (points >= 150) return { name: 'Especialista', next: 400, color: '#1a9ca9' }
  if (points >= 50) return { name: 'Colaborador', next: 150, color: '#34c759' }
  return { name: 'Iniciante', next: 50, color: '#8e8e93' }
}

/** Converte o trecho destacado da busca ([[termo]]) em HTML seguro com <mark> */
export function highlight(snippet: string | null | undefined) {
  const esc = (snippet ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc.replace(/\[\[/g, '<mark>').replace(/\]\]/g, '</mark>')
}
