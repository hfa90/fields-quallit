import { Link } from 'react-router-dom'
import { Bookmark, ChevronRight, Eye, LayoutGrid, Layers, List, MessageSquare, Paperclip, Rows3, ThumbsUp, Zap } from 'lucide-react'
import type { Category, TutorialListItem } from '../lib/types'
import { DIFFICULTY, cn, timeAgo } from '../lib/utils'
import { cdShort } from '../lib/cds'
import { useFavorites } from '../lib/library'
import { Avatar, CategoryIcon, VerifiedBadge } from './ui'
import TutorialCard from './TutorialCard'
import HScroll from './HScroll'

export const VIEW_MODES = ['cards', 'list', 'compact', 'grouped'] as const
export type ViewMode = typeof VIEW_MODES[number]
const META: Record<ViewMode, { label: string; icon: typeof List }> = {
  cards: { label: 'Cartões', icon: LayoutGrid },
  list: { label: 'Lista', icon: List },
  compact: { label: 'Compacto', icon: Rows3 },
  grouped: { label: 'Por categoria', icon: Layers },
}

/** Botões para trocar o modo de visualizar */
export function ViewSwitcher({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Modo de visualizar" className="inline-flex shrink-0 rounded-[9px] bg-neutral-900/[.06] p-0.5 dark:bg-white/10">
      {VIEW_MODES.map(m => {
        const { label, icon: I } = META[m]
        const on = value === m
        return (
          <button key={m} role="radio" aria-checked={on} title={label} onClick={() => onChange(m)}
            className={cn('inline-flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 text-[13px] font-medium transition',
              on ? 'bg-surface text-neutral-900 shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-neutral-600 dark:text-white' : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200')}>
            <I className="size-4" /><span className={cn('hidden lg:inline', on && 'sm:inline')}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Renderiza a lista de tutoriais no modo escolhido */
export function TutorialCollection({ items, mode, cats }: { items: TutorialListItem[]; mode: ViewMode; cats: Category[] }) {
  if (mode === 'list') return <div className="card divide-y divide-neutral-200/70 overflow-hidden dark:divide-neutral-800">{items.map((t, i) => <TutorialRow key={t.id} t={t} i={i} />)}</div>
  if (mode === 'compact') return <CompactTable items={items} />
  if (mode === 'grouped') return <Grouped items={items} cats={cats} />
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((t, i) => <TutorialCard key={t.id} t={t} i={i} />)}</div>
}

function Badges({ t }: { t: TutorialListItem }) {
  return <>
    {t.verified && <VerifiedBadge title={t.verified_by_name ? `Verificado por ${t.verified_by_name}` : undefined} />}
    {t.kind === 'quick' && <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/12 px-2 py-0.5 text-[11px] font-semibold text-brand-orange-dark"><Zap className="size-3" />Dica rápida</span>}
  </>
}

function Stats({ t }: { t: TutorialListItem }) {
  return (
    <span className="flex shrink-0 items-center gap-2.5 text-[12px] text-neutral-500">
      {!!t.helpful_count && <span className="inline-flex items-center gap-1 text-[#248a3d] dark:text-[#30d158]"><ThumbsUp className="size-3.5" />{t.helpful_count}</span>}
      {!!t.comment_count && <span className="inline-flex items-center gap-1"><MessageSquare className="size-3.5" />{t.comment_count}</span>}
      {t.attachment_count > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="size-3.5" />{t.attachment_count}</span>}
      <span className="inline-flex items-center gap-1"><Eye className="size-3.5" />{t.viewer_count}</span>
    </span>
  )
}

/** Modo Lista: uma linha por tutorial, com resumo */
function TutorialRow({ t, i }: { t: TutorialListItem; i: number }) {
  const { favs, toggle } = useFavorites()
  const fav = favs.has(t.id)
  const color = t.category_color ?? '#8e8e93'
  return (
    <div className="group relative fade-up" style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}>
      <Link to={`/t/${t.short_code}`} state={{ inApp: true }} className="flex gap-3.5 px-4 py-3.5 pr-12 transition-colors hover:bg-neutral-900/[.025] dark:hover:bg-white/[.03]">
        <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-[11px]" style={{ background: `${color}1a`, color }}><CategoryIcon name={t.category_icon} className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-[16px] font-semibold leading-snug tracking-tight text-neutral-900 dark:text-white">{t.title}</span>
            <Badges t={t} />
          </span>
          {t.summary && <span className="mt-0.5 block text-[14px] leading-snug text-neutral-500 line-clamp-1">{t.summary}</span>}
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-neutral-500">
            <span style={{ color }} className="font-medium">{t.category_name ?? 'Geral'}</span>
            <span className="text-neutral-300 dark:text-neutral-700">·</span>
            <span className="inline-flex items-center gap-1"><Avatar name={t.author_name} url={t.author_avatar} size={16} />{t.author_name}{t.author_cd && <span className="text-neutral-400"> · {cdShort(t.author_cd)}</span>}</span>
            <span className="text-neutral-300 dark:text-neutral-700">·</span>
            <span>{timeAgo(t.created_at)}</span>
            <span className="ml-auto"><Stats t={t} /></span>
          </span>
        </span>
      </Link>
      <button onClick={() => toggle(t.id)} aria-label={fav ? 'Remover dos favoritos' : 'Favoritar'}
        className={cn('absolute right-3 top-3.5 grid size-8 place-items-center rounded-full transition', fav ? 'text-brand-orange' : 'text-neutral-300 hover:text-neutral-500 dark:text-neutral-600')}>
        <Bookmark className="size-[18px]" fill={fav ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}

/** Modo Compacto: tabela densa (no celular, linhas enxutas) */
function CompactTable({ items }: { items: TutorialListItem[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="hidden grid-cols-[minmax(0,1fr)_150px_170px_90px_70px] gap-3 border-b border-neutral-200/70 bg-neutral-900/[.02] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 md:grid dark:border-neutral-800 dark:bg-white/[.03]">
        <span>Tutorial</span><span>Categoria</span><span>Autor</span><span>Publicado</span><span className="text-right">Leitores</span>
      </div>
      <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
        {items.map(t => {
          const d = DIFFICULTY[t.difficulty]
          return (
            <Link key={t.id} to={`/t/${t.short_code}`} state={{ inApp: true }}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-[13.5px] transition-colors hover:bg-neutral-900/[.025] md:grid-cols-[minmax(0,1fr)_150px_170px_90px_70px] dark:hover:bg-white/[.03]">
              <span className="flex min-w-0 items-center gap-2">
                <CategoryIcon name={t.category_icon} className="size-4 shrink-0 md:hidden" style={{ color: t.category_color ?? '#8e8e93' }} />
                <span className="truncate font-medium text-neutral-900 dark:text-white">{t.title}</span>
                {t.verified && <span className="shrink-0"><VerifiedBadge /></span>}
                {t.kind === 'quick' && <Zap className="size-3.5 shrink-0 text-brand-orange" />}
              </span>
              <span className="hidden min-w-0 items-center gap-1.5 truncate md:flex" style={{ color: t.category_color ?? '#8e8e93' }}>
                <CategoryIcon name={t.category_icon} className="size-3.5 shrink-0" /><span className="truncate">{t.category_name ?? 'Geral'}</span>
              </span>
              <span className="hidden min-w-0 truncate text-neutral-600 md:block dark:text-neutral-400">{t.author_name}</span>
              <span className="hidden text-neutral-500 md:block" title={d.label}>{timeAgo(t.created_at)}</span>
              <span className="inline-flex items-center justify-end gap-1 text-neutral-500"><Eye className="size-3.5" />{t.viewer_count}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/** Modo Por categoria: uma faixa por categoria */
function Grouped({ items, cats }: { items: TutorialListItem[]; cats: Category[] }) {
  const order = new Map(cats.map((c, i) => [c.id, i]))
  const groups = new Map<string, TutorialListItem[]>()
  for (const t of items) {
    const k = t.category_id ?? 'none'
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(t)
  }
  const keys = [...groups.keys()].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
  return (
    <div className="space-y-6">
      {keys.map(k => {
        const list = groups.get(k)!
        const t0 = list[0]
        const color = t0.category_color ?? '#8e8e93'
        return (
          <section key={k}>
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="grid size-7 place-items-center rounded-[8px]" style={{ background: `${color}1a`, color }}><CategoryIcon name={t0.category_icon} className="size-4" /></span>
              <h3 className="text-[17px] font-semibold tracking-tight text-neutral-900 dark:text-white">{t0.category_name ?? 'Geral'}</h3>
              <span className="text-[13px] text-neutral-400">{list.length}</span>
              {k !== 'none' && <Link to={`/?c=${k}`} className="ml-auto flex items-center text-[14px] text-accent-600 dark:text-accent-400">Só esta<ChevronRight className="size-4" /></Link>}
            </div>
            <HScroll label={t0.category_name ?? 'Geral'} className="-mx-4 flex gap-3 px-4 pb-1 sm:-mx-1 sm:px-1">
              {list.map((t, i) => <div key={t.id} className="grid w-[280px] shrink-0 sm:w-[300px]"><TutorialCard t={t} i={i} /></div>)}
            </HScroll>
          </section>
        )
      })}
    </div>
  )
}
