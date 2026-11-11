import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Eye, Paperclip, Plus, BookOpenText, Clock, Flame, ArrowDownAZ, FileEdit, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Category, TutorialListItem } from '../lib/types'
import { Avatar, CategoryIcon, Empty } from '../components/ui'
import { DIFFICULTY, cn, timeAgo } from '../lib/utils'

const COLS = 'id,short_code,title,summary,category_id,tags,difficulty,status,author_id,created_at,updated_at,author_name,author_avatar,category_name,category_color,category_icon,viewer_count,view_count,attachment_count'
type Sort = 'recent' | 'views' | 'az'

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

  const featured = useMemo(() => cats.filter(c => counts[c.id]), [cats, counts])

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-sky-500 px-6 py-10 text-white shadow-xl shadow-indigo-600/20 sm:px-10 sm:py-12">
        <div className="absolute -right-20 -top-20 size-72 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 right-40 size-64 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
            {mine ? 'Meus tutoriais' : <>Olá, {profile?.full_name?.split(' ')[0]} 👋</>}
          </h1>
          <p className="mt-2 text-indigo-100 sm:text-lg">
            {mine ? 'Tudo o que você publicou e seus rascunhos.' : 'Encontre a solução que você precisa ou compartilhe o que você sabe.'}
          </p>
          <div className="relative mt-6">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              value={input} onChange={e => setInput(e.target.value)}
              placeholder='Buscar: "VPN", "instalar Linux", "impressora"…'
              className="w-full rounded-2xl border-0 bg-white py-4 pl-12 pr-12 text-slate-900 shadow-lg outline-none ring-4 ring-white/20 placeholder:text-slate-400 focus:ring-white/40"
            />
            {input && <button onClick={() => setInput('')} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button>}
          </div>
        </div>
      </section>

      {/* Categorias */}
      <section className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <Chip active={!cat} onClick={() => setParam('c', '')} color="#4f46e5" icon="book-open" label="Todos" count={counts.all} />
        {(featured.length ? featured : cats).map(c => (
          <Chip key={c.id} active={cat === c.id} onClick={() => setParam('c', cat === c.id ? '' : c.id)} color={c.color} icon={c.icon} label={c.name} count={counts[c.id]} />
        ))}
      </section>

      {/* Ordenação */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-500">
          {items ? `${items.length} tutorial${items.length === 1 ? '' : 's'}` : 'Carregando…'}{q && <> para “<span className="text-slate-800 dark:text-slate-200">{q}</span>”</>}
        </h2>
        <div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          {([['recent', Clock, 'Recentes'], ['views', Flame, 'Mais vistos'], ['az', ArrowDownAZ, 'A–Z']] as const).map(([k, I, l]) => (
            <button key={k} onClick={() => setParam('o', k === 'recent' ? '' : k)}
              className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
                sort === k ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}>
              <I className="size-3.5" /><span className="hidden sm:inline">{l}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {!items ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800" />)}
        </div>
      ) : items.length === 0 ? (
        <Empty icon={<BookOpenText className="size-8" />} title={q || cat ? 'Nada encontrado' : 'Nenhum tutorial ainda'}>
          {q || cat ? 'Tente outros termos ou remova os filtros.' : (
            <Link to="/novo" className="mt-3 inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:underline"><Plus className="size-4" />Publicar o primeiro tutorial</Link>
          )}
        </Empty>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((t, i) => <TutorialCard key={t.id} t={t} i={i} />)}
        </div>
      )}
    </div>
  )
}

function Chip({ active, onClick, color, icon, label, count }: { active: boolean; onClick: () => void; color: string; icon: string; label: string; count?: number }) {
  return (
    <button onClick={onClick}
      className={cn('inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition',
        active ? 'border-transparent text-white shadow-md' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300')}
      style={active ? { background: color, boxShadow: `0 6px 16px -6px ${color}` } : undefined}>
      <CategoryIcon name={icon} className="size-4" style={active ? undefined : { color }} />
      {label}
      {count != null && <span className={cn('rounded-md px-1.5 text-xs', active ? 'bg-white/25' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}>{count}</span>}
    </button>
  )
}

function TutorialCard({ t, i }: { t: TutorialListItem; i: number }) {
  const color = t.category_color ?? '#64748b'
  const d = DIFFICULTY[t.difficulty]
  return (
    <Link to={`/t/${t.short_code}`} state={{ inApp: true }}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/60 hover:ring-slate-300 dark:bg-slate-900 dark:ring-slate-800 dark:hover:shadow-none dark:hover:ring-slate-700 fade-up"
      style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold" style={{ color, background: `${color}14` }}>
            <CategoryIcon name={t.category_icon} className="size-3.5" />{t.category_name ?? 'Sem categoria'}
          </span>
          {t.status === 'draft'
            ? <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><FileEdit className="size-3" />Rascunho</span>
            : <span className={cn('text-xs font-medium', d.style)}>{'●'.repeat(d.dots)}<span className="opacity-30">{'●'.repeat(3 - d.dots)}</span> {d.label}</span>}
        </div>
        <h3 className="mt-3 text-lg font-bold leading-snug text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400 line-clamp-2">{t.title}</h3>
        {t.summary && <p className="mt-1.5 text-sm text-slate-500 line-clamp-2 dark:text-slate-400">{t.summary}</p>}
        {t.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {t.tags.slice(0, 4).map(tag => <span key={tag} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">#{tag}</span>)}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-5">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={t.author_name} url={t.author_avatar} size={26} />
            <div className="min-w-0 text-xs">
              <div className="truncate font-medium text-slate-700 dark:text-slate-300">{t.author_name}</div>
              <div className="text-slate-400">{timeAgo(t.created_at)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {t.attachment_count > 0 && <span className="inline-flex items-center gap-1" title="Anexos"><Paperclip className="size-3.5" />{t.attachment_count}</span>}
            <span className="inline-flex items-center gap-1" title={`${t.viewer_count} pessoa(s) visualizaram`}><Eye className="size-3.5" />{t.viewer_count}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
