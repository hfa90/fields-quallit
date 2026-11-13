import { Link } from 'react-router-dom'
import { Eye, Paperclip, ChevronRight, ThumbsUp, AlertTriangle, Bookmark, MessageSquare, CalendarClock, CloudCheck } from 'lucide-react'
import type { TutorialListItem } from '../lib/types'
import { DIFFICULTY, cn, timeAgo } from '../lib/utils'
import { useFavorites } from '../lib/library'
import { useOfflineIds } from '../lib/offline'
import { Avatar, CategoryIcon, VerifiedBadge } from './ui'

export default function TutorialCard({ t, i = 0 }: { t: TutorialListItem; i?: number }) {
  const { favs, toggle } = useFavorites()
  const color = t.category_color ?? '#8e8e93'
  const d = DIFFICULTY[t.difficulty]
  const fav = favs.has(t.id)
  const offline = useOfflineIds().has(t.id)
  return (
    <div className="card group relative flex flex-col transition-shadow hover:shadow-[0_0_0_0.5px_rgb(0_0_0/0.1),0_8px_24px_-8px_rgb(0_0_0/0.15)] fade-up"
      style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
      <Link to={`/t/${t.short_code}`} state={{ inApp: true }} className="press flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-center gap-2 pr-8 text-[12px] font-medium">
          <span className="inline-flex items-center gap-1.5" style={{ color }}>
            <CategoryIcon name={t.category_icon} className="size-3.5" />{t.category_name ?? 'Geral'}
          </span>
          <span className="text-neutral-300 dark:text-neutral-700">·</span>
          {t.status === 'draft' ? <span className="text-brand-orange">Rascunho</span> : <span className="text-neutral-500">{d.label}</span>}
        </div>
        {t.verified && <div className="mt-2"><VerifiedBadge title={t.verified_by_name ? `Verificado por ${t.verified_by_name}` : undefined} /></div>}
        <h3 className="mt-2 text-[17px] font-semibold leading-snug tracking-tight text-neutral-900 line-clamp-2 dark:text-white">{t.title}</h3>
        {t.summary && <p className="mt-1 text-[14px] leading-relaxed text-neutral-500 line-clamp-2">{t.summary}</p>}
        {!!t.outdated_count && (
          <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-md bg-brand-orange/10 px-1.5 py-0.5 text-[12px] font-medium text-brand-orange-dark">
            <AlertTriangle className="size-3" />{t.outdated_count} relato{t.outdated_count > 1 ? 's' : ''} de passo desatualizado
          </span>
        )}
        {t.review_due && !t.outdated_count && (
          <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-md bg-neutral-900/[.05] px-1.5 py-0.5 text-[12px] font-medium text-neutral-600 dark:bg-white/10 dark:text-neutral-400">
            <CalendarClock className="size-3" />Revisão pendente
          </span>
        )}
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
            {offline && <span className="text-[#34c759]" title="Disponível offline"><CloudCheck className="size-3.5" /></span>}
            {!!t.helpful_count && <span className="inline-flex items-center gap-1 text-[#248a3d] dark:text-[#30d158]" title="Funcionou para"><ThumbsUp className="size-3.5" />{t.helpful_count}</span>}
            {!!t.comment_count && <span className="inline-flex items-center gap-1" title="Comentários"><MessageSquare className="size-3.5" />{t.comment_count}</span>}
            {t.attachment_count > 0 && <span className="inline-flex items-center gap-1" title="Anexos"><Paperclip className="size-3.5" />{t.attachment_count}</span>}
            <span className="inline-flex items-center gap-1" title={`${t.viewer_count} pessoa(s) visualizaram`}><Eye className="size-3.5" />{t.viewer_count}</span>
          </span>
        </div>
      </Link>
      <button onClick={() => toggle(t.id)} aria-label={fav ? 'Remover dos favoritos' : 'Favoritar'} title={fav ? 'Remover dos favoritos' : 'Favoritar'}
        className={cn('absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full transition', fav ? 'text-brand-orange' : 'text-neutral-300 hover:text-neutral-500 dark:text-neutral-600')}>
        <Bookmark className="size-[18px]" fill={fav ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}

/** Cartão compacto para faixas horizontais (Continuar lendo / Favoritos) */
export function MiniCard({ t, sub }: { t: TutorialListItem; sub?: string }) {
  const color = t.category_color ?? '#8e8e93'
  return (
    <Link to={`/t/${t.short_code}`} state={{ inApp: true }} className="card press flex w-[230px] shrink-0 flex-col p-3.5 sm:w-[250px]">
      <span className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color }}><CategoryIcon name={t.category_icon} className="size-3.5" />{t.category_name ?? 'Geral'}</span>
      <span className="mt-1.5 text-[15px] font-semibold leading-snug text-neutral-900 line-clamp-2 dark:text-white">{t.title}</span>
      {sub && <span className="mt-auto pt-2 text-[12px] text-neutral-500">{sub}</span>}
    </Link>
  )
}

export function Shelf({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-end justify-between px-1">
        <h2 className="text-[20px] font-bold tracking-tight text-neutral-900 dark:text-white">{title}</h2>
        {action}
      </div>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-1 sm:px-1">{children}</div>
    </section>
  )
}

export function MoreLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="flex items-center text-[15px] text-accent-600 dark:text-accent-400">{children}<ChevronRight className="size-4" /></Link>
}
