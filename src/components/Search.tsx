import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Clock, TrendingUp, Hash, FileText, HandHelping, UserRound, CornerDownLeft, ArrowRight, Loader2, SearchX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { SearchResult } from '../lib/types'
import { cn, highlight } from '../lib/utils'
import { Avatar, CategoryIcon, VerifiedBadge } from './ui'

// ---------- abrir a busca de qualquer lugar ----------
const openers = new Set<(q?: string) => void>()
export function openSearch(q?: string) { openers.forEach(o => o(q)) }

// ---------- buscas recentes (no aparelho) ----------
const RKEY = 'fq-recent-searches'
export function recentSearches(): string[] { try { return JSON.parse(localStorage.getItem(RKEY) || '[]') } catch { return [] } }
export function pushRecent(q: string) {
  const v = q.trim(); if (v.length < 2) return
  try { localStorage.setItem(RKEY, JSON.stringify([v, ...recentSearches().filter(x => x.toLowerCase() !== v.toLowerCase())].slice(0, 8))) } catch { /* ignore */ }
}
function clearRecent() { try { localStorage.removeItem(RKEY) } catch { /* ignore */ } }

export interface Suggestions { popular: string[]; tags: string[]; missing: { q: string; n: number }[] }
let sugCache: Suggestions | null = null
export function useSuggestions() {
  const [s, setS] = useState<Suggestions | null>(sugCache)
  useEffect(() => {
    if (sugCache) return
    supabase.rpc('kb_search_suggestions').then(({ data }) => { sugCache = data as Suggestions; setS(sugCache) })
  }, [])
  return s
}

/** Busca com debounce; descarta respostas antigas */
export function useLiveSearch(q: string, limit = 12, delay = 160) {
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setResults(null); setLoading(false); return }
    setLoading(true)
    const id = ++seq.current
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('kb_search', { p_query: term, p_limit: limit, p_log: false })
      if (id !== seq.current) return
      if (error) console.error(error)
      setResults((data as SearchResult[]) ?? [])
      setLoading(false)
    }, delay)
    return () => clearTimeout(t)
  }, [q, limit, delay])
  return { results, loading }
}

export function logSearch(q: string) {
  if (q.trim().length >= 2) supabase.rpc('kb_search', { p_query: q.trim(), p_limit: 1, p_log: true }).then(() => {})
}

export function resultHref(r: SearchResult) {
  if (r.kind === 'tutorial') return `/t/${r.short_code}`
  if (r.kind === 'request') return `/comunidade/pedido/${r.id}`
  return `/pessoa/${r.id}`
}

const KIND = {
  tutorial: { label: 'Tutoriais', icon: FileText },
  request: { label: 'Pedidos da comunidade', icon: HandHelping },
  person: { label: 'Pessoas', icon: UserRound },
} as const

export function ResultRow({ r, active, onClick, big }: { r: SearchResult; active?: boolean; onClick: () => void; big?: boolean }) {
  return (
    <button onClick={onClick} data-active={active || undefined}
      className={cn('flex w-full items-start gap-3 px-4 text-left transition-colors', big ? 'py-3.5' : 'py-2.5',
        active ? 'bg-accent-500/10' : 'hover:bg-neutral-900/[.03] dark:hover:bg-white/[.04]')}>
      {r.kind === 'person'
        ? <Avatar name={r.title} email={r.snippet ?? undefined} url={r.author_avatar} size={32} />
        : <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px]" style={{ background: `${r.category_color ?? '#8e8e93'}1a`, color: r.category_color ?? '#8e8e93' }}>
            {r.kind === 'request' ? <HandHelping className="size-4" /> : <CategoryIcon name={r.category_icon} className="size-4" />}
          </span>}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn('truncate font-medium text-neutral-900 dark:text-white', big ? 'text-[16px]' : 'text-[15px]')}>{r.title}</span>
          {r.verified && <VerifiedBadge />}
          <span className="shrink-0 rounded-[5px] bg-neutral-900/[.05] px-1.5 py-px text-[11px] font-medium text-neutral-500 dark:bg-white/10">{r.matched_in}</span>
        </span>
        {r.snippet && r.kind !== 'person' && (
          <span className={cn('search-snippet mt-0.5 block text-neutral-500', big ? 'text-[14px] line-clamp-3' : 'text-[13px] line-clamp-2')}
            dangerouslySetInnerHTML={{ __html: highlight(r.snippet) }} />
        )}
        {r.kind === 'person' && <span className="block text-[13px] text-neutral-500">Ver perfil e tutoriais</span>}
        {big && r.kind !== 'person' && (r.category_name || r.author_name) && (
          <span className="mt-1 block text-[12px] text-neutral-400">{[r.category_name, r.author_name].filter(Boolean).join(' · ')}</span>
        )}
      </span>
    </button>
  )
}

/** Paleta de busca global: Ctrl+K / ⌘K ou tocando no campo de busca */
export function SearchPalette() {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { results, loading } = useLiveSearch(open ? q : '')
  const sug = useSuggestions()

  useEffect(() => {
    const o = (initial?: string) => { setQ(initial ?? ''); setActive(0); setRecent(recentSearches()); setOpen(true) }
    openers.add(o)
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); o() }
      else if (e.key === '/' && !(e.target as HTMLElement).closest('input,textarea,[contenteditable=true]')) { e.preventDefault(); o() }
    }
    window.addEventListener('keydown', key)
    return () => { openers.delete(o); window.removeEventListener('keydown', key) }
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => inputRef.current?.focus(), 30)
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => { setActive(0) }, [results])
  useEffect(() => { listRef.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' }) }, [active])

  const groups = useMemo(() => {
    const g: Record<string, SearchResult[]> = {}
    results?.forEach(r => { (g[r.kind] ||= []).push(r) })
    return (['tutorial', 'request', 'person'] as const).filter(k => g[k]?.length).map(k => ({ kind: k, items: g[k] }))
  }, [results])
  const flat = groups.flatMap(g => g.items)

  if (!open) return null
  const close = () => setOpen(false)
  const go = (r: SearchResult) => { pushRecent(q); logSearch(q); close(); nav(resultHref(r), { state: { inApp: true } }) }
  const all = (term = q) => { if (term.trim().length < 2) return; pushRecent(term); close(); nav(`/busca?q=${encodeURIComponent(term.trim())}`) }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, flat.length)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (flat[active]) go(flat[active]); else all() }
  }

  let idx = -1
  return (
    <div className="fixed inset-0 z-[60] flex justify-center sm:items-start sm:p-6 sm:pt-[10vh]" onKeyDown={onKey}>
      <div className="absolute inset-0 bg-black/40 animate-in" onClick={close} />
      <div className="pop-in relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-neutral-900 sm:h-auto sm:max-h-[75vh] sm:max-w-2xl sm:rounded-[16px]">
        <div className="pt-safe flex items-center gap-2 border-b border-neutral-200/80 px-3 dark:border-neutral-800">
          <Search className="ml-1 size-5 shrink-0 text-accent-600" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} type="search" enterKeyHint="search" autoComplete="off"
            placeholder="O que você precisa resolver?"
            className="h-14 min-w-0 flex-1 bg-transparent text-[17px] text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white [&::-webkit-search-cancel-button]:hidden" />
          {loading && <Loader2 className="size-4 animate-spin text-neutral-400" />}
          {q && <button onClick={() => { setQ(''); inputRef.current?.focus() }} className="p-1 text-neutral-400" aria-label="Limpar"><X className="size-4" /></button>}
          <button onClick={close} className="px-2 text-[15px] font-medium text-accent-600 sm:hidden">Cancelar</button>
          <kbd className="hidden rounded-md border border-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-400 sm:block dark:border-neutral-700">Esc</kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          {q.trim().length < 2 ? (
            <div className="space-y-5 p-4">
              {recent.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between text-[12px] font-medium uppercase tracking-wide text-neutral-500">
                    Buscas recentes <button onClick={() => { clearRecent(); setRecent([]) }} className="normal-case tracking-normal text-accent-600">Limpar</button>
                  </div>
                  <div className="flex flex-col">
                    {recent.map(r => (
                      <button key={r} onClick={() => setQ(r)} className="flex items-center gap-3 rounded-lg px-2 py-2 text-left text-[15px] text-neutral-800 hover:bg-neutral-900/[.04] dark:text-neutral-200 dark:hover:bg-white/5">
                        <Clock className="size-4 text-neutral-400" />{r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!!sug?.popular.length && (
                <ChipGroup title="Mais buscados" icon={<TrendingUp className="size-3.5" />} items={sug.popular} onPick={setQ} />
              )}
              {!!sug?.tags.length && (
                <ChipGroup title="Tags" icon={<Hash className="size-3.5" />} items={sug.tags} onPick={setQ} />
              )}
              <p className="px-1 text-[13px] leading-relaxed text-neutral-500">
                A busca entende palavras sem acento, erros de digitação e palavras parciais, e procura no título, no conteúdo, nos comandos, nos anexos, nos links, nos comentários, nos pedidos e nas pessoas.
              </p>
            </div>
          ) : results && results.length === 0 && !loading ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <SearchX className="size-10 text-neutral-300 dark:text-neutral-600" strokeWidth={1.4} />
              <p className="mt-3 text-[15px] font-medium text-neutral-800 dark:text-neutral-200">Nada encontrado para “{q}”</p>
              <p className="mt-1 text-[13px] text-neutral-500">Ninguém documentou isso ainda. Peça à comunidade!</p>
              <button onClick={() => { logSearch(q); close(); nav(`/comunidade?pedir=${encodeURIComponent(q.trim())}`) }}
                className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-brand-orange px-4 text-[15px] font-medium text-white">
                <HandHelping className="size-4" />Pedir um tutorial sobre isso
              </button>
            </div>
          ) : (
            <div className="py-1">
              {groups.map(g => {
                const K = KIND[g.kind]
                return (
                  <div key={g.kind} className="py-1">
                    <div className="flex items-center gap-1.5 px-4 pb-1 pt-2 text-[12px] font-medium uppercase tracking-wide text-neutral-500"><K.icon className="size-3.5" />{K.label}</div>
                    {g.items.map(r => { idx++; const i = idx; return <ResultRow key={r.kind + r.id} r={r} active={i === active} onClick={() => go(r)} /> })}
                  </div>
                )
              })}
              {flat.length > 0 && (
                <button onClick={() => all()} data-active={active === flat.length || undefined}
                  className={cn('flex w-full items-center gap-2 border-t border-neutral-200/70 px-4 py-3 text-[14px] font-medium text-accent-600 dark:border-neutral-800 dark:text-accent-400',
                    active === flat.length && 'bg-accent-500/10')}>
                  Ver todos os resultados para “{q}” <ArrowRight className="size-4" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="hidden items-center gap-4 border-t border-neutral-200/80 px-4 py-2 text-[12px] text-neutral-400 sm:flex dark:border-neutral-800">
          <span className="flex items-center gap-1"><kbd className="font-sans">↑↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><CornerDownLeft className="size-3" /> abrir</span>
          <span className="ml-auto">Atalho: Ctrl K ou /</span>
        </div>
      </div>
    </div>
  )
}

function ChipGroup({ title, icon, items, onPick }: { title: string; icon: React.ReactNode; items: string[]; onPick: (s: string) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-neutral-500">{icon}{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(t => (
          <button key={t} onClick={() => onPick(t)} className="rounded-full bg-neutral-900/[.05] px-3 py-1.5 text-[13px] text-neutral-700 hover:bg-neutral-900/[.09] dark:bg-white/10 dark:text-neutral-300">{t}</button>
        ))}
      </div>
    </div>
  )
}

/** Campo de busca de destaque da página inicial */
export function HeroSearch() {
  const sug = useSuggestions()
  const chips = [...(sug?.popular ?? []), ...(sug?.tags ?? [])].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6)
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <section className="relative overflow-hidden rounded-[20px] bg-accent-600 px-5 py-7 text-white sm:px-8 sm:py-9 dark:bg-accent-700">
      <svg className="pointer-events-none absolute -right-10 -top-12 size-56 opacity-[.12]" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="34" fill="none" stroke="#fff" strokeWidth="13" />
      </svg>
      <span className="pointer-events-none absolute bottom-6 right-10 hidden h-4 w-16 rotate-45 rounded-full bg-brand-orange/80 sm:block" />
      <div className="relative">
        <h2 className="text-[22px] font-bold leading-tight tracking-tight sm:text-[26px]">O que você precisa resolver hoje?</h2>
        <p className="mt-1 text-[14px] text-white/75 sm:text-[15px]">Busque em todos os tutoriais, comandos, anexos, pedidos e pessoas.</p>
        <button onClick={() => openSearch()}
          className="press mt-5 flex h-14 w-full items-center gap-3 rounded-[14px] bg-white px-4 text-left shadow-[0_10px_30px_-10px_rgb(0_0_0/0.4)]">
          <Search className="size-5 text-accent-600" strokeWidth={2.4} />
          <span className="flex-1 truncate text-[16px] text-neutral-400">Ex.: vpn, instalar linux, impressora não imprime…</span>
          <kbd className="hidden rounded-md border border-neutral-200 px-1.5 py-0.5 text-[12px] text-neutral-400 sm:block">{mac ? '⌘' : 'Ctrl'} K</kbd>
        </button>
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map(c => (
              <button key={c} onClick={() => openSearch(c)} className="rounded-full bg-white/15 px-3 py-1 text-[13px] text-white hover:bg-white/25">{c}</button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
