import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { UserStats } from '../lib/types'
import { cdShort } from '../lib/cds'
import { Avatar } from './ui'

/**
 * Faixa com os Fields da equipe (foto, nome e CD) acima da busca.
 * Tocar em alguém abre o perfil com as publicações dele.
 */
export default function TeamStrip() {
  const [people, setPeople] = useState<UserStats[] | null>(null)
  useEffect(() => {
    supabase.from('kb_user_stats').select('user_id,full_name,avatar_url,email,points,tutorials,cd_name,role,created_at')
      .order('points', { ascending: false }).limit(40)
      .then(({ data }) => setPeople((data as UserStats[]) ?? []))
  }, [])

  if (!people) return <div className="no-scrollbar -mx-4 flex gap-3 overflow-hidden px-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[104px] w-[76px] shrink-0 animate-pulse rounded-2xl bg-neutral-200/60 dark:bg-neutral-800" />)}</div>
  if (people.length === 0) return null

  return (
    <section>
      <div className="mb-2 flex items-end justify-between px-1">
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-neutral-500">Equipe Fields</h2>
        <Link to="/comunidade?aba=ranking" className="flex items-center text-[13px] text-accent-600 dark:text-accent-400">Ver todos<ChevronRight className="size-4" /></Link>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-3 pb-1 sm:-mx-1 sm:px-0">
        {people.map(p => (
          <Link key={p.user_id} to={`/pessoa/${p.user_id}`} className="press flex w-[78px] shrink-0 flex-col items-center rounded-2xl px-1 py-1.5 text-center hover:bg-neutral-900/[.04] dark:hover:bg-white/[.05]"
            title={`${p.full_name ?? ''}${p.cd_name ? ` · ${p.cd_name}` : ''}`}>
            <span className="relative">
              <span className="block rounded-full p-[2px]" style={{ background: p.tutorials > 0 ? 'linear-gradient(135deg,#1a9ca9,#fe811e)' : 'transparent', boxShadow: p.tutorials > 0 ? undefined : 'inset 0 0 0 1.5px rgb(0 0 0 / .1)' }}>
                <span className="block rounded-full bg-neutral-50 p-[2px] dark:bg-neutral-950">
                  <Avatar name={p.full_name} email={p.email} url={p.avatar_url} size={54} />
                </span>
              </span>
              {p.tutorials > 0 && (
                <span className="absolute -bottom-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-white ring-2 ring-neutral-50 dark:ring-neutral-950" title={`${p.tutorials} publicações`}>{p.tutorials}</span>
              )}
            </span>
            <span className="mt-1.5 w-full truncate text-[12px] font-semibold text-neutral-900 dark:text-white">{(p.full_name ?? p.email).split(' ')[0]}</span>
            <span className="w-full truncate text-[10.5px] font-medium text-accent-700 dark:text-accent-400">{p.cd_name ? cdShort(p.cd_name) : '—'}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
