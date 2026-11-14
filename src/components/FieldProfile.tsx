import { Suspense, lazy, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { Award, Eye, FileText, HandHelping, MapPin, MessageSquare, MousePointerClick, ThumbsUp, UserCheck, UserPlus, Users, ChevronRight, Mail, CalendarDays, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { TutorialListItem, UserStats } from '../lib/types'
import { LIST_COLS, useFollows } from '../lib/library'
import { ROLE_LABEL, cn, fmtDate, level, timeAgo } from '../lib/utils'
import { cdShort } from '../lib/cds'
import { UF_NAME } from '../lib/brStates'
import { Avatar, CategoryIcon, Modal, Spinner } from './ui'
import StateBadge from './StateBadge'
import { ImpactCard } from './Engagement'

// só administradores usam: carregado sob demanda
const DeleteUserModal = lazy(() => import('../pages/DeleteUserModal'))

/** "Recife · Pernambuco"; sem repetir quando o CD tem o nome do estado */
const placeLabel = (cd: string, uf: string | null) => { const c = cdShort(cd); return uf && UF_NAME[uf] !== c ? `${c} · ${UF_NAME[uf]}` : c }

function Level({ points, className }: { points: number; className?: string }) {
  const l = level(points)
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-px text-[11px] font-semibold', className)} style={{ color: l.color, background: `${l.color}1a` }}><Award className="size-3" />{l.name}</span>
}

/** Card secundário que aparece ao passar o mouse sobre um Field */
export function FieldHoverCard({ p, uf, rect, onEnter, onLeave, onOpen }: { p: UserStats; uf: string | null; rect: DOMRect; onEnter: () => void; onLeave: () => void; onOpen: () => void }) {
  const W = 288
  const left = Math.min(Math.max(8, rect.left + rect.width / 2 - W / 2), window.innerWidth - W - 8)
  const below = window.innerHeight - rect.bottom > 230
  const style = below ? { left, top: rect.bottom + 8, width: W } : { left, bottom: window.innerHeight - rect.top + 8, width: W }
  return createPortal(
    <div role="tooltip" onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onOpen} style={style}
      className="hover-card-in fixed z-40 cursor-pointer overflow-hidden rounded-[16px] bg-surface shadow-[0_0_0_0.5px_rgb(0_0_0/0.12),0_18px_40px_-12px_rgb(0_0_0/0.35)] dark:bg-neutral-900 dark:shadow-[0_0_0_0.5px_rgb(255_255_255/0.12),0_18px_40px_-12px_rgb(0_0_0/0.7)]">
      <div className="flex items-center gap-3 p-3.5">
        <StateBadge uf={uf} size={58} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-neutral-900 dark:text-white">{p.full_name ?? p.email}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-neutral-500">{ROLE_LABEL[p.role]}</span>
            <Level points={p.points} />
          </div>
          <div className="mt-1 flex items-center gap-1 text-[12px] font-medium text-accent-700 dark:text-accent-400">
            <MapPin className="size-3 shrink-0" /><span className="truncate">{p.cd_name ? placeLabel(p.cd_name, uf) : 'CD não informado'}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 border-t border-neutral-200/70 text-center dark:border-neutral-800">
        {([[p.tutorials, 'publicações'], [p.helpful_received, 'funcionou'], [p.points, 'pontos']] as const).map(([n, l]) => (
          <div key={l} className="py-2"><div className="text-[16px] font-bold tabular-nums text-neutral-900 dark:text-white">{n}</div><div className="text-[11px] text-neutral-500">{l}</div></div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1.5 bg-neutral-900/[.03] py-2 text-[12px] text-neutral-500 dark:bg-white/[.04]">
        <MousePointerClick className="size-3.5" />Clique para ver todas as informações
      </div>
    </div>,
    document.body,
  )
}

/** Popup com todas as informações do Field dentro do sistema */
export function FieldProfileModal({ userId, uf, onClose, onDeleted }: { userId: string | null; uf: string | null; onClose: () => void; onDeleted?: () => void }) {
  const { profile } = useAuth()
  const follows = useFollows()
  const nav = useNavigate()
  const [u, setU] = useState<UserStats | null | undefined>(undefined)
  const [posts, setPosts] = useState<TutorialListItem[] | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!userId) return
    setU(undefined); setPosts(null)
    supabase.from('kb_user_stats').select('*').eq('user_id', userId).maybeSingle().then(({ data }) => setU((data as UserStats) ?? null))
    supabase.from('kb_tutorials_list').select(LIST_COLS).eq('author_id', userId).eq('status', 'published').order('created_at', { ascending: false }).limit(6)
      .then(({ data }) => setPosts((data as unknown as TutorialListItem[]) ?? []))
  }, [userId])

  const me = u?.user_id === profile?.id
  const following = u ? follows.isFollowing({ author: u.user_id }) : false
  const l = u ? level(u.points) : null
  const pct = u && l ? (l.next ? Math.min(100, Math.round((u.points / l.next) * 100)) : 100) : 0

  return (
    <Modal open={!!userId} onClose={onClose} title="Perfil do Field">
      {u === undefined ? <Spinner /> : !u || !l ? (
        <p className="py-10 text-center text-[14px] text-neutral-500">Não foi possível carregar este perfil. Tente novamente.</p>
      ) : (
        <div className="space-y-5 pb-1">
          <div className="relative overflow-hidden rounded-[16px] bg-[radial-gradient(circle_at_25%_30%,rgb(26_156_169/0.18),transparent_60%),radial-gradient(circle_at_90%_90%,rgb(254_129_30/0.12),transparent_55%)] p-4">
            <div className="flex items-center gap-4">
              <span className="state-pop"><StateBadge uf={uf} size={104} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Avatar name={u.full_name} email={u.email} url={u.avatar_url} size={26} />
                  <h2 className="truncate text-[20px] font-bold tracking-tight text-neutral-900 dark:text-white">{u.full_name ?? u.email}</h2>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5"><span className="text-[13px] text-neutral-500">{ROLE_LABEL[u.role]}</span><Level points={u.points} /></div>
                <div className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-accent-500/10 px-2.5 py-1 text-[12.5px] font-semibold text-accent-700 dark:text-accent-300">
                  <MapPin className="size-3.5 shrink-0" /><span className="truncate">{u.cd_name ? `${u.cd_name}${uf && cdShort(u.cd_name) !== UF_NAME[uf] ? ` · ${UF_NAME[uf]}` : ''}` : 'CD não informado'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-[13.5px] text-neutral-600 dark:text-neutral-400">
            <div className="flex items-center gap-2"><Mail className="size-4 text-neutral-400" /><a href={`mailto:${u.email}`} className="truncate text-accent-600 dark:text-accent-400">{u.email}</a></div>
            <div className="flex items-center gap-2"><CalendarDays className="size-4 text-neutral-400" />Na central desde {fmtDate(u.created_at)}</div>
          </div>

          <div>
            <div className="flex justify-between text-[12px] text-neutral-500"><span><b className="text-neutral-900 dark:text-white">{u.points}</b> pontos · nível {l.name}</span>{l.next && <span>{l.next - u.points} para o próximo</span>}</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: l.color }} /></div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([[FileText, u.tutorials, 'publicações'], [ThumbsUp, u.helpful_received, 'funcionou'], [Eye, u.views_received, 'leituras'],
              [MessageSquare, u.comments, 'comentários'], [HandHelping, u.requests_answered, 'pedidos atendidos'], [Users, u.followers, 'seguidores']] as const).map(([I, n, label]) => (
              <div key={label} className="rounded-[12px] bg-neutral-900/[.035] px-2 py-2.5 text-center dark:bg-white/[.05]">
                <I className="mx-auto size-4 text-accent-600" />
                <div className="mt-1 text-[17px] font-bold tabular-nums text-neutral-900 dark:text-white">{n}</div>
                <div className="text-[11px] leading-tight text-neutral-500">{label}</div>
              </div>
            ))}
          </div>

          <ImpactCard userId={u.user_id} me={me} />

          <section>
            <h3 className="mb-2 text-[15px] font-semibold text-neutral-900 dark:text-white">Publicações recentes</h3>
            {!posts ? <Spinner /> : posts.length === 0 ? (
              <p className="rounded-[12px] bg-neutral-900/[.035] px-3 py-4 text-center text-[13px] text-neutral-500 dark:bg-white/[.05]">Ainda não publicou nada.</p>
            ) : (
              <div className="divide-y divide-neutral-200/70 overflow-hidden rounded-[12px] bg-neutral-900/[.025] dark:divide-neutral-800 dark:bg-white/[.04]">
                {posts.map(t => (
                  <Link key={t.id} to={`/t/${t.short_code}`} state={{ inApp: true }} onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-900/[.03] dark:hover:bg-white/[.04]">
                    <CategoryIcon name={t.category_icon} className="size-4 shrink-0" style={{ color: t.category_color ?? '#8e8e93' }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-neutral-900 dark:text-white">{t.title}</span>
                      <span className="text-[11.5px] text-neutral-500">{timeAgo(t.created_at)} · {t.viewer_count} leitores{t.helpful_count ? ` · 👍 ${t.helpful_count}` : ''}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-neutral-400" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <div className="grid grid-cols-2 gap-2">
            {me ? (
              <button onClick={() => { onClose(); nav('/perfil') }} className="press h-11 rounded-[10px] bg-neutral-900/[.06] text-[15px] font-medium text-neutral-800 dark:bg-white/10 dark:text-neutral-200">Editar perfil</button>
            ) : (
              <button onClick={() => follows.toggle({ author: u.user_id }, u.full_name ?? 'pessoa')}
                className={cn('press inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] text-[15px] font-medium', following ? 'bg-neutral-900/[.06] text-neutral-800 dark:bg-white/10 dark:text-neutral-200' : 'bg-accent-600 text-white')}>
                {following ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}{following ? 'Seguindo' : 'Seguir'}
              </button>
            )}
            <button onClick={() => { onClose(); nav(`/pessoa/${u.user_id}`) }} className="press inline-flex h-11 items-center justify-center gap-1 rounded-[10px] bg-neutral-900/[.06] text-[15px] font-medium text-neutral-800 dark:bg-white/10 dark:text-neutral-200">
              Página completa<ChevronRight className="size-4" />
            </button>
          </div>

          {profile?.role === 'admin' && !me && (
            <button onClick={() => setDeleting(true)} className="press mx-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13.5px] font-medium text-[#ff3b30] hover:bg-[#ff3b30]/10">
              <Trash2 className="size-4" />Excluir este Field
            </button>
          )}
          {deleting && (
            <Suspense fallback={null}>
              <DeleteUserModal user={{ id: u.user_id, full_name: u.full_name, email: u.email }} onClose={() => setDeleting(false)}
                onDeleted={() => { setDeleting(false); onClose(); onDeleted?.() }} />
            </Suspense>
          )}
        </div>
      )}
    </Modal>
  )
}
