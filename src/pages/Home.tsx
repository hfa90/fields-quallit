import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Eye, Paperclip, Plus, BookOpenText, XCircle, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Category, TutorialListItem } from '../lib/types'
import { Avatar, CategoryIcon, Empty } from '../components/ui'
import { DIFFICULTY, cn, timeAgo } from '../lib/utils'
import { InstallBanner } from '../components/InstallApp'

const COLS = 'id,short_code,title,summary,category_id,tags,difficulty,status,author_id,created_at,updated_at,author_name,author_avatar,category_name,category_color,category_icon,viewer_count,view_count,attachment_count'
type Sort = 'recent' | 'views' | 'az'
const SORTS: [Sort, string][] = [['recent', 'Recentes'], ['views', 'Mais vistos'], ['az', 'A–Z']]

export default function Home({ mine }: { mine?: boolean }) {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const cat = params.get('c') ?? ''
  const sort = (params.get('o') as Sort) || 'recent'
  const [input, setInput] = useState(q)
  const [items, setItems] = useState<TutorialListItem[] | null>(null)
  const [cats, setCats] = useState<Category[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v); else p.delete(k)
    setParams(p, { replace: true })
  }

  useEffect(() => { setInput(q) }, [q])
  useEffect(() => {
    const t = setTimeout(() => { if (input !== q) setParam('q', input.trim()) }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input])

  useEffect(() => {
    supabase.from('kb_categories').select('*').order('sort_order').then(({ data }) => setCats(data ?? []))
  }, [])

  useEffect(() => {
    let alive = true
    setItems(null)
    let query = supabase.from('kb_tutorials_list').select(COLS)
    if (mine) query = query.eq('author_id', profile!.id)
    else query = query.eq('status', 'published')
    if (cat) query = query.eq('category_id', cat)
    const term = q.replace(/[,()*%"\\:]/g, ' ').trim()
    if (term) query = query.or(`title.ilike.*${term}*,summary.ilike.*${term}*,search.wfts(portuguese).${term}`)
    if (sort === 'views') query = query.order('view_count', { ascending: false })
    else if (sort === 'az') query = query.order('title')
    else query = query.order('created_at', { ascending: false })
    query.limit(200).then(({ data, error }) => {
      if (!alive) return
      if (error) console.error(error)
      setItems((data as unknown as TutorialListItem[]) ?? [])
    })
    return () => { alive = false }
  }, [q, cat, sort, mine, profile])

  useEffect(() => {
    let query = supabase.from('kb_tutorials').select('category_id')
    query = mine ? query.eq('author_id', profile!.id) : query.eq('status', 'published')
    query.then(({ data }) => {
      const c: Record<string, number> = {}
      data?.forEach(r => { const k = r.category_id ?? 'none'; c[k] = (c[k] ?? 0) + 1; c.all = (c.all ?? 0) + 1 })
      setCounts(c)
    })
  }, [mine, profile])

  const visibleCats = cats.filter(c => counts[c.id])

  return (
    <div className="space-y-5">
      {/* Título grande */}
      <div className="flex items-end justify-between gap-4 pt-1">
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-neutral-900 sm:text-[34px] dark:text-white">{mine ? 'Meus tutoriais' : 'Biblioteca'}</h1>
          <p className="mt-0.5 text-[15px] text-neutral-500">
            {mine ? 'Seus tutoriais publicados e rascunhos' : `Olá, ${profile?.full_name?.split(' ')[0] ?? ''}. Encontre ou compartilhe uma solução.`}
          </p>
        </div>
      </div>

      {!mine && <InstallBanner />}

      {/* Busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-[17px] -translate-y-1/2 text-neutral-400" />
        <input
          value={input} onChange={e => setInput(e.target.value)} type="search" enterKeyHint="search"
          placeholder="Buscar tutoriais, comandos, tags…"
          className="h-11 w-full rounded-[10px] bg-neutral-900/[.06] pl-9 pr-9 text-[16px] text-neutral-900 outline-none placeholder:text-neutral-500 focus:bg-neutral-900/[.08] dark:bg-white/10 dark:text-white dark:placeholder:text-neutral-400 [&::-webkit-search-cancel-button]:hidden"
        />
        {input && <button onClick={() => setInput('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600" aria-label="Limpar busca"><XCircle className="size-[18px]" fill="currentColor" stroke="white" /></button>}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Chip active={!cat} onClick={() => setParam('c', '')} label="Todos" count={counts.all} />
          {visibleCats.map(c => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setParam('c', cat === c.id ? '' : c.id)} label={c.name} count={counts[c.id]}
              icon={<CategoryIcon name={c.icon} className="size-3.5" style={{ color: cat === c.id ? undefined : c.color }} />} />
          ))}
        </div>
        <div className="inline-flex shrink-0 self-start rounded-[9px] bg-neutral-900/[.06] p-0.5 dark:bg-white/10">
          {SORTS.map(([k, l]) => (
            <button key={k} onClick={() => setParam('o', k === 'recent' ? '' : k)}
              className={cn('h-7 rounded-[7px] px-3 text-[13px] font-medium transition',
                sort === k ? 'bg-white text-neutral-900 shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-neutral-600 dark:text-white' : 'text-neutral-600 dark:text-neutral-300')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {!items ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-44 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <Empty icon={<BookOpenText className="size-12" strokeWidth={1.4} />} title={q || cat ? 'Nenhum resultado' : 'Nenhum tutorial ainda'}>
          {q || cat ? 'Tente outros termos ou remova os filtros.' : (
            <Link to="/novo" className="mt-2 inline-flex items-center gap-1 font-medium text-accent-600"><Plus className="size-4" />Publicar o primeiro tutorial</Link>
          )}
        </Empty>
      ) : (
        <>
          <p className="px-1 text-[13px] text-neutral-500">{items.length} {items.length === 1 ? 'tutorial' : 'tutoriais'}{q && <> para “{q}”</>}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t, i) => <TutorialCard key={t.id} t={t} i={i} />)}
          </div>
        </>
      )}
    </div>
  )
}

function Chip({ active, onClick, label, count, icon }: { active: boolean; onClick: () => void; label: string; count?: number; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn('press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors',
        active ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-white text-neutral-700 shadow-[0_0_0_0.5px_rgb(0_0_0/0.12)] hover:bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-300 dark:shadow-[0_0_0_0.5px_rgb(255_255_255/0.12)]')}>
      {icon}{label}
      {count != null && <span className={cn('tabular-nums', active ? 'opacity-60' : 'text-neutral-400')}>{count}</span>}
    </button>
  )
}

function TutorialCard({ t, i }: { t: TutorialListItem; i: number }) {
  const color = t.category_color ?? '#8e8e93'
  const d = DIFFICULTY[t.difficulty]
  return (
    <Link to={`/t/${t.short_code}`} state={{ inApp: true }}
      className="card press group flex flex-col p-4 transition-shadow hover:shadow-[0_0_0_0.5px_rgb(0_0_0/0.1),0_8px_24px_-8px_rgb(0_0_0/0.15)] fade-up sm:p-5"
      style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
      <div className="flex items-center gap-2 text-[12px] font-medium">
        <span className="inline-flex items-center gap-1.5" style={{ color }}>
          <CategoryIcon name={t.category_icon} className="size-3.5" />{t.category_name ?? 'Geral'}
        </span>
        <span className="text-neutral-300 dark:text-neutral-700">·</span>
        {t.status === 'draft'
          ? <span className="text-[#ff9500]">Rascunho</span>
          : <span className="text-neutral-500">{d.label}</span>}
        <ChevronRight className="ml-auto size-4 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-400 dark:text-neutral-600" />
      </div>
      <h3 className="mt-2 text-[17px] font-semibold leading-snug tracking-tight text-neutral-900 line-clamp-2 dark:text-white">{t.title}</h3>
      {t.summary && <p className="mt-1 text-[14px] leading-relaxed text-neutral-500 line-clamp-2">{t.summary}</p>}
      {t.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {t.tags.slice(0, 4).map(tag => <span key={tag} className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[12px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">{tag}</span>)}
        </div>
      )}
      <div className="mt-auto flex items-center gap-2 pt-4 text-[12px] text-neutral-500">
        <Avatar name={t.author_name} url={t.author_avatar} size={20} />
        <span className="truncate">{t.author_name}</span>
        <span className="text-neutral-300 dark:text-neutral-700">·</span>
        <span className="shrink-0">{timeAgo(t.created_at)}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2.5">
          {t.attachment_count > 0 && <span className="inline-flex items-center gap-1" title="Anexos"><Paperclip className="size-3.5" />{t.attachment_count}</span>}
          <span className="inline-flex items-center gap-1" title={`${t.viewer_count} pessoa(s) visualizaram`}><Eye className="size-3.5" />{t.viewer_count}</span>
        </span>
      </div>
    </Link>
  )
}
