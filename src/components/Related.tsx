import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { LIST_COLS } from '../lib/library'
import type { TutorialListItem } from '../lib/types'
import { CategoryIcon, Skeleton, VerifiedBadge } from './ui'

type Item = TutorialListItem & { verified?: boolean; reason?: string }

/** "Quem viu este também viu…": evita que a pessoa volte para a busca no fim do tutorial */
export default function Related({ tutorialId, categoryId }: { tutorialId: string; categoryId: string | null }) {
  const [items, setItems] = useState<Item[] | null>(null)

  useEffect(() => {
    let alive = true
    setItems(null)
    ;(async () => {
      let ids: { tutorial_id: string; reason: string }[] = []
      const r = await supabase.rpc('kb_related', { p_tutorial: tutorialId, p_limit: 6 })
      if (!r.error) ids = (r.data as typeof ids) ?? []
      else if (categoryId) {
        // reserva: mesma categoria, mais vistos
        const f = await supabase.from('kb_tutorials_list').select('id').eq('status', 'published').eq('category_id', categoryId)
          .neq('id', tutorialId).order('view_count', { ascending: false }).limit(6)
        ids = (f.data ?? []).map(x => ({ tutorial_id: x.id as string, reason: 'similar' }))
      }
      if (!ids.length) { if (alive) setItems([]); return }
      const { data } = await supabase.from('kb_tutorials_list').select(LIST_COLS).in('id', ids.map(x => x.tutorial_id))
      const byId = new Map(((data as unknown as Item[]) ?? []).map(t => [t.id, t]))
      if (alive) setItems(ids.map(x => byId.get(x.tutorial_id) && { ...byId.get(x.tutorial_id)!, reason: x.reason }).filter(Boolean) as Item[])
    })()
    return () => { alive = false }
  }, [tutorialId, categoryId])

  if (items && !items.length) return null
  const coview = items?.some(t => t.reason === 'coview')
  return (
    <section className="no-print">
      <h2 className="mb-3 flex items-center gap-2 px-1 text-[20px] font-bold tracking-tight text-neutral-900 dark:text-white">
        {coview ? <Users className="size-5 text-accent-600" /> : <Sparkles className="size-5 text-accent-600" />}
        {coview ? 'Quem viu este também viu' : 'Veja também'}
      </h2>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {!items
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="card space-y-2 p-3.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-4/5" /></div>)
          : items.map(t => (
            <Link key={t.id} to={`/t/${t.short_code}`} state={{ inApp: true }} className="card press flex items-start gap-3 p-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-[9px]" style={{ background: `${t.category_color ?? '#8e8e93'}1a`, color: t.category_color ?? '#8e8e93' }}>
                <CategoryIcon name={t.category_icon} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug text-neutral-900 line-clamp-2 dark:text-white">{t.title}</span>
                <span className="mt-1 flex items-center gap-1.5 text-[12px] text-neutral-500">
                  {t.verified && <VerifiedBadge />}
                  <span className="truncate">{[t.category_name, t.view_count ? `${t.view_count} visualizações` : null].filter(Boolean).join(' · ')}</span>
                </span>
              </span>
            </Link>
          ))}
      </div>
    </section>
  )
}
