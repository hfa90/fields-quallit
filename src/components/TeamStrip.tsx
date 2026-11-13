import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { UserStats } from '../lib/types'
import { cdShort, useCdUf } from '../lib/cds'
import StateBadge from './StateBadge'
import { FieldHoverCard, FieldProfileModal } from './FieldProfile'

/**
 * "Fields pelo Brasil": cada Field aparece com o mapa do estado do seu CD,
 * pintado com a bandeira do estado. Tocar abre o perfil com as publicações.
 */
export default function TeamStrip() {
  const [people, setPeople] = useState<UserStats[] | null>(null)
  const ufOf = useCdUf()
  const [hover, setHover] = useState<{ p: UserStats; rect: DOMRect } | null>(null)
  const [open, setOpen] = useState<UserStats | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const canHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
  const show = (p: UserStats, el: HTMLElement) => {
    if (!canHover) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setHover({ p, rect: el.getBoundingClientRect() }), hover ? 60 : 320)
  }
  const hide = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setHover(null), 140) }
  const keep = () => window.clearTimeout(timer.current)
  useEffect(() => {
    if (!hover) return
    const close = () => setHover(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
  }, [hover])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => {
    supabase.from('kb_user_stats').select('user_id,full_name,avatar_url,email,points,tutorials,cd_name,role,created_at')
      .order('points', { ascending: false }).limit(40)
      .then(({ data }) => setPeople((data as UserStats[]) ?? []))
  }, [])

  if (!people) return <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-hidden px-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="card h-[160px] w-[128px] shrink-0 animate-pulse" />)}</div>
  if (people.length === 0) return null
  const cds = new Set(people.map(p => p.cd_name).filter(Boolean)).size

  return (
    <section>
      <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-[20px] font-bold tracking-tight text-neutral-900 dark:text-white">Fields pelo Brasil</h2>
          <p className="text-[13px] text-neutral-500">{people.length} {people.length === 1 ? 'Field' : 'Fields'}{cds > 0 && ` em ${cds} ${cds === 1 ? 'CD' : 'CDs'}`} · toque para ver o perfil</p>
        </div>
        <Link to="/comunidade?aba=ranking" className="flex shrink-0 items-center text-[15px] text-accent-600 dark:text-accent-400">Ver todos<ChevronRight className="size-4" /></Link>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 pt-0.5 sm:-mx-1 sm:px-1">
        {people.map(p => {
          const uf = ufOf(p.cd_name)
          const first = (p.full_name ?? p.email).split(' ')
          return (
            <Link key={p.user_id} to={`/pessoa/${p.user_id}`} aria-label={`${p.full_name ?? ''}${p.cd_name ? ` · ${p.cd_name}` : ''}`}
              onClick={e => { e.preventDefault(); window.clearTimeout(timer.current); setHover(null); setOpen(p) }}
              onMouseEnter={e => show(p, e.currentTarget)} onMouseLeave={hide} onFocus={e => show(p, e.currentTarget)} onBlur={hide}
              className="card press group flex w-[128px] shrink-0 flex-col overflow-hidden transition-shadow hover:shadow-[0_0_0_0.5px_rgb(0_0_0/0.1),0_8px_20px_-8px_rgb(0_0_0/0.18)]">
              <div className="relative grid h-[96px] place-items-center pt-2 bg-[radial-gradient(circle_at_50%_40%,rgb(26_156_169/0.10),transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_40%,rgb(26_156_169/0.16),transparent_70%)]">
                <StateBadge uf={uf} size={90} className="transition-transform duration-300 group-hover:scale-105" />
                {uf && <span className="absolute left-2 top-2 rounded-md bg-neutral-900/75 px-1.5 py-px text-[10px] font-bold tracking-wide text-white backdrop-blur dark:bg-white/85 dark:text-neutral-900">{uf}</span>}
                {p.tutorials > 0 && <span className="absolute right-2 top-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-white" title={`${p.tutorials} publicações`}>{p.tutorials}</span>}
              </div>
              <div className="px-2.5 pb-2.5 pt-1.5">
                <div className="truncate text-[13.5px] font-semibold text-neutral-900 dark:text-white">{first[0]}{first.length > 1 && ` ${first[first.length - 1][0]}.`}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[11.5px] font-medium text-accent-700 dark:text-accent-400">
                  <MapPin className="size-3 shrink-0" /><span className="truncate">{p.cd_name ? cdShort(p.cd_name) : 'CD não informado'}</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
      {hover && <FieldHoverCard p={hover.p} uf={ufOf(hover.p.cd_name)} rect={hover.rect} onEnter={keep} onLeave={hide} onOpen={() => { const p = hover.p; setHover(null); setOpen(p) }} />}
      <FieldProfileModal userId={open?.user_id ?? null} uf={open ? ufOf(open.cd_name) : null} onClose={() => setOpen(null)} />
    </section>
  )
}
