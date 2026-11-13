import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, UserPlus, UserCheck, FileText, ThumbsUp, HandHelping, Eye, Users, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { TutorialListItem, UserStats } from '../lib/types'
import { LIST_COLS, useFollows } from '../lib/library'
import { ROLE_LABEL, cn, fmtDate, level } from '../lib/utils'
import { Avatar, Empty, Spinner } from '../components/ui'
import TutorialCard from '../components/TutorialCard'
import { LevelBadge } from './Community'
import { ImpactCard } from '../components/Engagement'
import NotFound from './NotFound'
import StateBadge from '../components/StateBadge'
import { useCdUf } from '../lib/cds'

export default function PersonPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { profile } = useAuth()
  const follows = useFollows()
  const ufOf = useCdUf()
  const [u, setU] = useState<UserStats | null | undefined>(undefined)
  const [items, setItems] = useState<TutorialListItem[] | null>(null)

  useEffect(() => {
    setU(undefined); setItems(null)
    supabase.from('kb_user_stats').select('*').eq('user_id', id).maybeSingle().then(({ data }) => setU((data as UserStats) ?? null))
    supabase.from('kb_tutorials_list').select(LIST_COLS).eq('author_id', id).eq('status', 'published').order('created_at', { ascending: false })
      .then(({ data }) => setItems((data as unknown as TutorialListItem[]) ?? []))
  }, [id])

  if (u === undefined) return <Spinner />
  if (u === null) return <NotFound message="Pessoa não encontrada" />
  const me = u.user_id === profile?.id
  const following = follows.isFollowing({ author: u.user_id })
  const l = level(u.points)
  const pct = l.next ? Math.min(100, Math.round((u.points / l.next) * 100)) : 100

  return (
    <div className="space-y-6 fade-up">
      <button onClick={() => nav(-1)} className="-ml-2 inline-flex h-9 items-center text-[17px] text-accent-600 dark:text-accent-400"><ChevronLeft className="size-6" strokeWidth={2.2} />Voltar</button>

      <div className="card p-5 sm:p-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar name={u.full_name} email={u.email} url={u.avatar_url} size={84} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-[24px] font-bold tracking-tight text-neutral-900 dark:text-white">{u.full_name}</h1>
              <LevelBadge points={u.points} className="text-[12px]" />
            </div>
            {u.cd_name && <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-accent-500/10 px-3 py-1 text-[13px] font-semibold text-accent-700 dark:text-accent-300">{ufOf(u.cd_name) ? <StateBadge uf={ufOf(u.cd_name)} size={20} /> : <Building2 className="size-3.5" />}{u.cd_name}</div>}
            <div className="mt-1 text-[14px] text-neutral-500">{ROLE_LABEL[u.role]} · na central desde {fmtDate(u.created_at)}</div>
            <div className="mx-auto mt-3 max-w-xs sm:mx-0">
              <div className="flex justify-between text-[12px] text-neutral-500"><span><b className="text-neutral-900 dark:text-white">{u.points}</b> pontos</span>{l.next && <span>{l.next - u.points} para o próximo nível</span>}</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: l.color }} /></div>
            </div>
          </div>
          {me ? (
            <button onClick={() => nav('/perfil')} className="press h-9 rounded-full bg-neutral-900/[.06] px-4 text-[14px] font-medium text-neutral-800 dark:bg-white/10 dark:text-neutral-200">Editar perfil</button>
          ) : (
            <button onClick={() => follows.toggle({ author: u.user_id }, u.full_name ?? 'pessoa')}
              className={cn('press inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium', following ? 'bg-neutral-900/[.06] text-neutral-800 dark:bg-white/10 dark:text-neutral-200' : 'bg-accent-600 text-white')}>
              {following ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}{following ? 'Seguindo' : 'Seguir'}
            </button>
          )}
        </div>
        <div className="mt-5 grid grid-cols-5 gap-2 border-t border-neutral-200/70 pt-4 text-center dark:border-neutral-800">
          {([[FileText, u.tutorials, 'tutoriais'], [ThumbsUp, u.helpful_received, 'funcionou'], [HandHelping, u.requests_answered, 'pedidos'], [Eye, u.views_received, 'leituras'], [Users, u.followers, 'seguidores']] as const).map(([I, n, label]) => (
            <div key={label}><I className="mx-auto size-4 text-accent-600" /><div className="mt-1 text-[17px] font-bold tabular-nums text-neutral-900 dark:text-white">{n}</div><div className="text-[11px] text-neutral-500">{label}</div></div>
          ))}
        </div>
      </div>

      <ImpactCard userId={u.user_id} me={me} />

      <section>
        <h2 className="mb-3 px-1 text-[20px] font-bold tracking-tight text-neutral-900 dark:text-white">Tutoriais publicados</h2>
        {!items ? <Spinner /> : items.length === 0 ? <Empty icon={<FileText className="size-12" strokeWidth={1.4} />} title="Nenhum tutorial publicado ainda" /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((t, i) => <TutorialCard key={t.id} t={t} i={i} />)}</div>
        )}
      </section>
    </div>
  )
}
