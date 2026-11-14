import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, BookOpenText, BellPlus, BellRing, ChevronDown, Loader2, History, Bookmark, Zap } from 'lucide-react'
import HScroll from '../components/HScroll'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Category, TutorialListItem } from '../lib/types'
import { CategoryIcon, Empty, CardsSkeleton } from '../components/ui'
import { cn, timeAgo } from '../lib/utils'
import { LIST_COLS, fetchFavorites, fetchRecent, useFollows } from '../lib/library'
import { MiniCard, MoreLink, Shelf } from '../components/TutorialCard'
import { TutorialCollection, VIEW_MODES, ViewSwitcher } from '../components/TutorialViews'
import { usePref } from '../lib/prefs'
import { getProgress, hasResume, progressLabel } from '../lib/progress'
import { HeroSearch } from '../components/Search'
import TeamStrip from '../components/TeamStrip'
import { GapCard, ShareCallout, useGaps } from '../components/Engagement'
import { TrailCard, type Trail } from './TrailPage'
import { useNavigate } from 'react-router-dom'

type Sort = 'recent' | 'views' | 'helpful' | 'az'
const PAGE = 100
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
  const nav = useNavigate()
  const [trails, setTrails] = useState<(Trail & { total: number; done: number })[]>([])
  const gaps = useGaps()
  const [view, setView] = usePref('home_view', VIEW_MODES, 'cards')
  const [shelfTab, setShelfTab] = usePref('home_shelf', ['recent', 'favorites'] as const, 'recent')
  const [total, setTotal] = useState<number | null>(null)
  const [moreBusy, setMoreBusy] = useState(false)

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
    Promise.all([
      supabase.from('kb_trails').select('*, items:kb_trail_items(count)').eq('status', 'published').order('created_at', { ascending: false }).limit(8),
      supabase.from('kb_trail_progress').select('trail_id').eq('user_id', profile!.id),
    ]).then(([t, p]) => {
      const done = new Map<string, number>()
      p.data?.forEach(r => done.set(r.trail_id, (done.get(r.trail_id) ?? 0) + 1))
      setTrails(((t.data ?? []) as (Trail & { items: { count: number }[] })[]).map(x => ({ ...x, total: x.items?.[0]?.count ?? 0, done: done.get(x.id) ?? 0 })))
    })
  }, [])

  const buildQuery = () => {
    let query = supabase.from('kb_tutorials_list').select(LIST_COLS, { count: 'exact' }).eq('status', 'published')
    if (cat) query = query.eq('category_id', cat)
    // tutoriais verificados sempre aparecem primeiro
    if (sort !== 'az') query = query.order('verified', { ascending: false })
    if (sort === 'views') query = query.order('view_count', { ascending: false })
    else if (sort === 'helpful') query = query.order('helpful_count', { ascending: false }).order('view_count', { ascending: false })
    else if (sort === 'az') query = query.order('title')
    else query = query.order('created_at', { ascending: false })
    return query.order('id') // desempate estável entre páginas
  }

  useEffect(() => {
    let alive = true
    setItems(null); setTotal(null)
    buildQuery().range(0, PAGE - 1).then(({ data, error, count }) => {
      if (!alive) return
      if (error) console.error(error)
      setItems((data as unknown as TutorialListItem[]) ?? [])
      setTotal(count ?? null)
    })
    return () => { alive = false }
  }, [cat, sort]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    if (!items) return
    setMoreBusy(true)
    const { data, error, count } = await buildQuery().range(items.length, items.length + PAGE - 1)
    setMoreBusy(false)
    if (error) { console.error(error); return }
    const seen = new Set(items.map(t => t.id))
    setItems([...items, ...((data as unknown as TutorialListItem[]) ?? []).filter(t => !seen.has(t.id))])
    if (count != null) setTotal(count)
  }

  const visibleCats = cats.filter(c => counts[c.id])
  const selected = cats.find(c => c.id === cat)
  const following = selected && follows.isFollowing({ category: selected.id })

  return (
    <div className="space-y-7">
      <div className="pt-1">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-neutral-900 sm:text-[34px] dark:text-white">Biblioteca</h1>
        <p className="mt-0.5 text-[15px] text-neutral-500">Olá, {profile?.full_name?.split(' ')[0] ?? ''}. Tudo o que o time sabe, em um só lugar.</p>
      </div>

      <TeamStrip />

      <HeroSearch />

      <ShareCallout />

      {gaps && gaps.length > 0 && (
        <Shelf title="Colegas precisam de ajuda" action={<MoreLink to="/comunidade">Ver todas</MoreLink>}>
          {gaps.slice(0, 8).map(g => <GapCard key={g.query} g={g} compact />)}
        </Shelf>
      )}

      {(recent.length > 0 || favorites.length > 0) && (() => {
        const tabs = ([['recent', 'Continuar lendo', recent.length], ['favorites', 'Favoritos', favorites.length]] as const).filter(t => t[2] > 0)
        const active = tabs.some(t => t[0] === shelfTab) ? shelfTab : tabs[0][0]
        return (
          <section>
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <div role="tablist" aria-label="Seus tutoriais" className="no-scrollbar flex min-w-0 gap-1 overflow-x-auto">
                {tabs.map(([k, label, n]) => (
                  <button key={k} role="tab" aria-selected={active === k} onClick={() => setShelfTab(k)}
                    className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-semibold transition-colors',
                      active === k ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-500 hover:bg-neutral-900/[.05] hover:text-neutral-800 dark:hover:bg-white/[.06] dark:hover:text-neutral-200')}>
                    {k === 'recent' ? <History className="size-4" /> : <Bookmark className="size-4" />}{label}
                    <span className={cn('text-[12px] tabular-nums', active === k ? 'opacity-60' : 'text-neutral-400')}>{n}</span>
                  </button>
                ))}
              </div>
              <MoreLink to={active === 'recent' ? '/meus?aba=recentes' : '/meus?aba=favoritos'}>Ver tudo</MoreLink>
            </div>
            <HScroll key={active} label={active === 'recent' ? 'Continuar lendo' : 'Favoritos'} className="-mx-4 flex gap-3 px-4 pb-1 sm:-mx-1 sm:px-1">
              {active === 'recent'
                ? recent.map(t => {
                    const p = getProgress(profile?.id, t.short_code)
                    const resume = hasResume(p)
                    return <MiniCard key={t.id} t={t} sub={(resume && progressLabel(p)) || `Visto ${timeAgo(t.last_viewed)}`}
                      to={resume ? `/t/${t.short_code}?continuar=1` : undefined}
                      progress={resume && p?.step != null && p.total ? (p.step + 1) / p.total : undefined} />
                  })
                : favorites.slice(0, 12).map(t => <MiniCard key={t.id} t={t} sub={t.author_name ?? undefined} />)}
            </HScroll>
          </section>
        )
      })()}
      {trails.length > 0 && (
        <Shelf title="Trilhas de aprendizado" action={<MoreLink to="/trilhas">Ver todas</MoreLink>}>
          {trails.map(t => <TrailCard key={t.id} t={t} compact onClick={() => nav(`/trilhas/${t.id}`)} />)}
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

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="no-scrollbar -mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Chip active={!cat} onClick={() => setParam('c', '')} label="Todos" count={counts.all} />
            {visibleCats.map(c => (
              <Chip key={c.id} active={cat === c.id} onClick={() => setParam('c', cat === c.id ? '' : c.id)} label={c.name} count={counts[c.id]}
                icon={<CategoryIcon name={c.icon} className="size-3.5" style={{ color: cat === c.id ? undefined : c.color }} />} />
            ))}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
          <div className="no-scrollbar inline-flex shrink-0 overflow-x-auto rounded-[9px] bg-neutral-900/[.06] p-0.5 dark:bg-white/10">
            {SORTS.map(([k, l]) => (
              <button key={k} onClick={() => setParam('o', k === 'recent' ? '' : k)}
                className={cn('h-7 shrink-0 rounded-[7px] px-3 text-[13px] font-medium transition',
                  sort === k ? 'bg-surface text-neutral-900 shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-neutral-600 dark:text-white' : 'text-neutral-600 dark:text-neutral-300')}>
                {l}
              </button>
            ))}
          </div>
          <ViewSwitcher value={view} onChange={setView} />
          </div>
        </div>

        {!items ? (
          <CardsSkeleton />
        ) : items.length === 0 ? (
          <Empty icon={<BookOpenText className="size-12" strokeWidth={1.4} />} title={cat ? 'Nada nesta categoria ainda' : 'Nenhum tutorial ainda'}>
            <span className="mt-1 block max-w-sm text-[14px] text-neutral-500">Toda solução que você já aplicou em campo pode poupar horas de um colega. Comece com algo simples.</span>
            <span className="mt-4 flex flex-wrap justify-center gap-2">
              <Link to="/dica" className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-orange px-4 text-[14px] font-semibold text-white"><Zap className="size-4" />Dica rápida (30 s)</Link>
              <Link to="/novo" className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-neutral-900/[.06] px-4 text-[14px] font-semibold text-neutral-800 dark:bg-white/10 dark:text-neutral-100"><Plus className="size-4" />Tutorial completo</Link>
            </span>
          </Empty>
        ) : (
          <>
            <TutorialCollection items={items} mode={view} cats={cats} />
            {total != null && total > items.length && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <button onClick={loadMore} disabled={moreBusy}
                  className="press inline-flex h-11 items-center gap-2 rounded-full bg-surface px-6 text-[15px] font-semibold text-accent-700 shadow-[0_0_0_0.5px_rgb(0_0_0/0.12),0_2px_8px_-2px_rgb(0_0_0/0.12)] disabled:opacity-60 dark:bg-neutral-900 dark:text-accent-300">
                  {moreBusy ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}Carregar mais
                </button>
                <span className="text-[12.5px] text-neutral-500">Mostrando {items.length} de {total}</span>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function Chip({ active, onClick, label, count, icon }: { active: boolean; onClick: () => void; label: string; count?: number; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn('press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors',
        active ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-surface text-neutral-700 shadow-[0_0_0_0.5px_rgb(0_0_0/0.12)] hover:bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-300 dark:shadow-[0_0_0_0.5px_rgb(255_255_255/0.12)]')}>
      {icon}{label}
      {count != null && <span className={cn('tabular-nums', active ? 'opacity-60' : 'text-neutral-400')}>{count}</span>}
    </button>
  )
}
