import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, SearchX, HandHelping, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { SearchResult } from '../lib/types'
import { cn } from '../lib/utils'
import { ResultRow, pushRecent, resultHref } from '../components/Search'
import { Spinner } from '../components/ui'

type Filter = 'all' | 'tutorial' | 'request' | 'person'
const FILTERS: [Filter, string][] = [['all', 'Tudo'], ['tutorial', 'Tutoriais'], ['request', 'Pedidos'], ['person', 'Pessoas']]

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)
  const [filter, setFilter] = useState<Filter>('all')
  const [results, setResults] = useState<SearchResult[] | null>(null)

  useEffect(() => { setInput(q) }, [q])
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    setResults(null)
    pushRecent(q)
    supabase.rpc('kb_search', { p_query: q, p_limit: 60, p_log: true }).then(({ data }) => setResults((data as SearchResult[]) ?? []))
  }, [q])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: results?.length ?? 0 }
    results?.forEach(r => { c[r.kind] = (c[r.kind] ?? 0) + 1 })
    return c
  }, [results])
  const shown = results?.filter(r => filter === 'all' || r.kind === filter) ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-4 fade-up">
      <h1 className="pt-1 text-[32px] font-bold tracking-tight text-neutral-900 dark:text-white">Buscar</h1>
      <form onSubmit={e => { e.preventDefault(); setParams(input.trim() ? { q: input.trim() } : {}) }} className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-accent-600" />
        <input value={input} onChange={e => setInput(e.target.value)} autoFocus={!q} type="search" enterKeyHint="search"
          placeholder="O que você precisa resolver?"
          className="h-12 w-full rounded-[12px] bg-surface pl-11 pr-10 text-[17px] text-neutral-900 shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)] outline-none focus:shadow-[0_0_0_2px_var(--color-accent-500)] dark:bg-neutral-900 dark:text-white [&::-webkit-search-cancel-button]:hidden" />
        {input && <button type="button" onClick={() => { setInput(''); setParams({}) }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400"><X className="size-4" /></button>}
      </form>

      {q && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {FILTERS.map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={cn('press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium',
                filter === k ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-surface text-neutral-700 shadow-[0_0_0_0.5px_rgb(0_0_0/0.12)] dark:bg-neutral-900 dark:text-neutral-300')}>
              {l}<span className="opacity-50">{counts[k] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      {!q ? <p className="px-1 text-[15px] text-neutral-500">Digite pelo menos 2 letras. A busca ignora acentos e tolera erros de digitação.</p>
        : results === null ? <Spinner />
        : shown.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <SearchX className="size-12 text-neutral-300 dark:text-neutral-600" strokeWidth={1.4} />
            <p className="mt-3 text-[17px] font-semibold text-neutral-900 dark:text-white">Nenhum resultado para “{q}”</p>
            <p className="mt-1 text-[15px] text-neutral-500">Ainda não há conteúdo sobre isso. Que tal pedir à comunidade?</p>
            <button onClick={() => nav(`/comunidade?pedir=${encodeURIComponent(q)}`)} className="mt-5 inline-flex h-11 items-center gap-2 rounded-[10px] bg-brand-orange px-5 text-[15px] font-medium text-white">
              <HandHelping className="size-4" />Pedir um tutorial
            </button>
          </div>
        ) : (
          <>
            <p className="px-1 text-[13px] text-neutral-500">{shown.length} resultado{shown.length === 1 ? '' : 's'} · ordenados por relevância</p>
            <div className="card divide-y divide-neutral-200/70 overflow-hidden dark:divide-neutral-800">
              {shown.map(r => <ResultRow key={r.kind + r.id} r={r} big onClick={() => nav(resultHref(r), { state: { inApp: true } })} />)}
            </div>
          </>
        )}
    </div>
  )
}
