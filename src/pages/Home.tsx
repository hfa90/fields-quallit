import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, BookOpenText, BellPlus, BellRing } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Category, TutorialListItem } from '../lib/types'
import { CategoryIcon, Empty } from '../components/ui'
import { cn, timeAgo } from '../lib/utils'
import { LIST_COLS, fetchFavorites, fetchRecent, useFollows } from '../lib/library'
import TutorialCard, { MiniCard, MoreLink, Shelf } from '../components/TutorialCard'
import { HeroSearch } from '../components/Search'

type Sort = 'recent' | 'views' | 'helpful' | 'az'
const SORTS: [Sort, string][] = [['recent', 'Recentes'], ['views', 'Mais vistos'], ['helpful', 'Mais úteis'], ['az', 'A–Z']]

export default function Home() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const cat = params.get('c') ?? ''
  const sort = (params.get('o') as Sort) || 'recent'
  const [items, setItems] = useState<TutorialListItem[] | null>(null)
  const [cats, setCats] = useState<Category[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [recent, setRecent] = useState<(TutorialListItem & { last_viewed: string })[]>([])
  const [favorites, setFavorites] = useState<TutorialListItem[]>([])
  const follows = useFollows()

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v); else p.delete(k)
    setParams(p, { replace: true })
  }

  useEffect(() => {
    supabase.from('kb_categories').select('*').order('sort_order').then(({ data }) => setCats(data ?? []))
    supabase.from('kb_tutorials').select('category_id').eq('status', 'published').then(({ data }) => {
      const c: Record<string, number> = {}
      data?.forEach(r => { const k = r.category_id ?? 'none'; c[k] = (c[k] ?? 0) + 1; c.all = (c.all ?? 0) + 1 })
      setCounts(c)
    })
    fetchRecent(10).then(setRecent)
    fetchFavorites().then(setFavorites)
  }, [])

  useEffect(() => {
    let alive = true
    setItems(null)
    let query = supabase.from('kb_tutorials_list').select(LIST_COLS).eq('status', 'published')
    if (cat) query = query.eq('category_id', cat)
    if (sort === 'views') query = query.order('view_count', { ascending: false })
    else if (sort === 'helpful') query = query.order('helpful_count', { ascending: false }).order('view_count', { ascending: false })
    else if (sort === 'az') query = query.order('title')
    else query = query.order('created_at', { ascending: false })
    query.limit(200).then(({ data, error }) => {
      if (!alive) return
      if (error) console.error(error)
      setItems((data as unknown as TutorialListItem[]) ?? [])
    })
    return () => { alive = false }
  }, [cat, sort])

  const visibleCats = cats.filter(c => counts[c.id])
  const selected = cats.find(c => c.id === cat)
  const following = selected && follows.isFollowing({ category: selected.id })

  return (
    <div className="space-y-7">
      <div className="pt-1">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-neutral-900 sm:text-[34px] dark:text-white">Biblioteca</h1>
        <p className="mt-0.5 text-[15px] text-neutral-500">Olá, {profile?.full_name?.split(' ')[0] ?? ''}. Tudo o que o time sabe, em um só lugar.</p>
      </div>

      <HeroSearch />

      {recent.length > 0 && (
        <Shelf title="Continuar lendo" action={<MoreLink to="/meus?aba=recentes">Ver tudo</MoreLink>}>
          {recent.map(t => <MiniCard key={t.id} t={t} sub={`Visto ${timeAgo(t.last_viewed)}`} />)}
        </Shelf>
      )}
      {favorites.length > 0 && (
        <Shelf title="Favoritos" action={<MoreLink to="/meus?aba=favoritos">Ver tudo</MoreLink>}>
          {favorites.slice(0, 12).map(t => <MiniCard key={t.id} t={t} sub={t.author_name ?? undefined} />)}
        </Shelf>
      )}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3 px-1">
          <h2 className="text-[20px] font-bold tracking-tight text-neutral-900 dark:text-white">Todos os tutoriais</h2>
          {selected && (
            <button onClick={() => follows.toggle({ category: selected.id }, selected.name)}
              className={cn('press inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium',
                following ? 'bg-accent-500/10 text-accent-700 dark:text-accent-300' : 'bg-accent-600 text-white')}>
              {following ? <BellRing className="size-3.5" /> : <BellPlus className="size-3.5" />}{following ? 'Seguindo' : `Seguir ${selected.name}`}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Chip active={!cat} onClick={() => setParam('c', '')} label="Todos" count={counts.all} />
            {visibleCats.map(c => (
              <Chip key={c.id} active={cat === c.id} onClick={() => setParam('c', cat === c.id ? '' : c.id)} label={c.name} count={counts[c.id]}
                icon={<CategoryIcon name={c.icon} className="size-3.5" style={{ color: cat === c.id ? undefined : c.color }} />} />
            ))}
          </div>
          <div className="no-scrollbar inline-flex shrink-0 self-start overflow-x-auto rounded-[9px] bg-neutral-900/[.06] p-0.5 dark:bg-white/10">
            {SORTS.map(([k, l]) => (
              <button key={k} onClick={() => setParam('o', k === 'recent' ? '' : k)}
                className={cn('h-7 shrink-0 rounded-[7px] px-3 text-[13px] font-medium transition',
                  sort === k ? 'bg-white text-neutral-900 shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-neutral-600 dark:text-white' : 'text-neutral-600 dark:text-neutral-300')}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {!items ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-44 animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <Empty icon={<BookOpenText className="size-12" strokeWidth={1.4} />} title={cat ? 'Nada nesta categoria ainda' : 'Nenhum tutorial ainda'}>
            <Link to="/novo" className="mt-2 inline-flex items-center gap-1 font-medium text-accent-600"><Plus className="size-4" />Publicar o primeiro</Link>
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t, i) => <TutorialCard key={t.id} t={t} i={i} />)}
          </div>
        )}
      </section>
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
