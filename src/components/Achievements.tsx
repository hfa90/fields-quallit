import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Award, Zap, BookOpenText, Library, ThumbsUp, Heart, Users, Building2, HandHelping, MessageCircle, Sparkles, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAttention } from '../lib/attention'
import { cn } from '../lib/utils'

interface Stats { tutorials: number; helpful: number; thanks: number; people: number; cds: number; answered: number; comments: number }
interface Achievement { id: string; title: string; text: string; icon: typeof Award; color: string; goal: number; value: (s: Stats) => number }

/** Conquistas: marcos de quem compartilha e ajuda os colegas */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_post', title: 'Primeira contribuição', text: 'Publicou o primeiro tutorial ou dica', icon: Zap, color: '#fe811e', goal: 1, value: s => s.tutorials },
  { id: 'posts_5', title: 'Mão na massa', text: '5 publicações na biblioteca', icon: BookOpenText, color: '#0b5fb0', goal: 5, value: s => s.tutorials },
  { id: 'posts_20', title: 'Enciclopédia de campo', text: '20 publicações na biblioteca', icon: Library, color: '#5856d6', goal: 20, value: s => s.tutorials },
  { id: 'helpful_1', title: 'Funcionou!', text: 'Um colega marcou que seu tutorial funcionou', icon: ThumbsUp, color: '#34c759', goal: 1, value: s => s.helpful },
  { id: 'helpful_10', title: 'Solução garantida', text: '10 “funcionou” recebidos', icon: ThumbsUp, color: '#248a3d', goal: 10, value: s => s.helpful },
  { id: 'thanks_1', title: 'Primeiro obrigado', text: 'Recebeu o primeiro agradecimento', icon: Heart, color: '#ff2d55', goal: 1, value: s => s.thanks },
  { id: 'thanks_10', title: 'Querido(a) do time', text: '10 agradecimentos recebidos', icon: Heart, color: '#d81b60', goal: 10, value: s => s.thanks },
  { id: 'people_10', title: 'Rede de apoio', text: 'Ajudou 10 colegas diferentes', icon: Users, color: '#1a9ca9', goal: 10, value: s => s.people },
  { id: 'cds_3', title: 'Pelo Brasil', text: 'Ajudou colegas de 3 CDs', icon: Building2, color: '#8e5cd9', goal: 3, value: s => s.cds },
  { id: 'answered_1', title: 'Pedido atendido', text: 'Respondeu um pedido da comunidade', icon: HandHelping, color: '#ff9500', goal: 1, value: s => s.answered },
  { id: 'comments_10', title: 'Boa conversa', text: '10 comentários deixados', icon: MessageCircle, color: '#64748b', goal: 10, value: s => s.comments },
]

async function loadStats(userId: string): Promise<Stats | null> {
  const [u, imp] = await Promise.all([
    supabase.from('kb_user_stats').select('tutorials,helpful_received,comments,requests_answered').eq('user_id', userId).maybeSingle(),
    supabase.rpc('kb_impact', { p_user: userId }),
  ])
  if (u.error || imp.error || !u.data) return null
  const i = (imp.data ?? {}) as { people?: number; cds?: string[]; thanks?: number }
  return {
    tutorials: Number(u.data.tutorials) || 0, helpful: Number(u.data.helpful_received) || 0,
    comments: Number(u.data.comments) || 0, answered: Number(u.data.requests_answered) || 0,
    thanks: Number(i.thanks) || 0, people: Number(i.people) || 0, cds: i.cds?.length ?? 0,
  }
}
const unlocked = (s: Stats) => ACHIEVEMENTS.filter(a => a.value(s) >= a.goal).map(a => a.id)

/** Quadro de conquistas (Perfil e perfil público) */
export function AchievementsCard({ userId, me }: { userId: string; me?: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null)
  useEffect(() => { loadStats(userId).then(setStats) }, [userId])
  if (!stats) return null
  const got = new Set(unlocked(stats))
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-neutral-200/70 px-5 py-3.5 dark:border-neutral-800">
        <Award className="size-4 text-brand-orange" />
        <h2 className="text-[15px] font-semibold text-neutral-900 dark:text-white">Conquistas</h2>
        <span className="ml-auto text-[13px] tabular-nums text-neutral-500">{got.size} de {ACHIEVEMENTS.length}</span>
      </div>
      <ul className="grid grid-cols-2 gap-px bg-neutral-200/70 sm:grid-cols-3 lg:grid-cols-4 dark:bg-neutral-800">
        {ACHIEVEMENTS.map(a => {
          const ok = got.has(a.id)
          const v = Math.min(a.value(stats), a.goal)
          if (!ok && !me) return null // no perfil dos outros, só o que já foi conquistado
          return (
            <li key={a.id} className="flex items-start gap-3 bg-surface px-4 py-3.5 dark:bg-neutral-900" title={a.text}>
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', !ok && 'grayscale opacity-40')}
                style={{ background: `${a.color}1f`, color: a.color }}>
                {ok ? <a.icon className="size-5" /> : <Lock className="size-4" />}
              </span>
              <span className="min-w-0">
                <span className={cn('block text-[14px] font-semibold leading-tight', ok ? 'text-neutral-900 dark:text-white' : 'text-neutral-500')}>{a.title}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-neutral-500">{a.text}</span>
                {!ok && a.goal > 1 && (
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <span className="block h-full rounded-full" style={{ width: `${(v / a.goal) * 100}%`, background: a.color }} />
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      {!me && got.size === 0 && <p className="px-5 py-4 text-[14px] text-neutral-500">Nenhuma conquista ainda.</p>}
    </section>
  )
}

const SEEN_KEY = (uid: string) => `fq-badges:${uid}`
const CHECK_GAP = 10 * 60 * 1000

/**
 * Celebra conquistas novas: confere ao abrir o Fields e de tempos em tempos ao navegar.
 * Na primeira vez só registra o que a pessoa já tinha (sem chuva de celebrações).
 * A celebração passa pela fila de avisos: se outro aviso já apareceu neste acesso, fica para o próximo.
 */
export function AchievementWatcher() {
  const { profile } = useAuth()
  const loc = useLocation()
  const [fresh, setFresh] = useState<Achievement[]>([])
  const [last, setLast] = useState(0)
  const [open, setOpen] = useState(false)
  const uid = profile?.id

  useEffect(() => {
    if (!uid || Date.now() - last < CHECK_GAP) return
    setLast(Date.now())
    loadStats(uid).then(s => {
      if (!s) return
      const now = unlocked(s)
      let seen: string[] | null = null
      try { seen = JSON.parse(localStorage.getItem(SEEN_KEY(uid)) || 'null') } catch { /* ignore */ }
      if (!seen) { try { localStorage.setItem(SEEN_KEY(uid), JSON.stringify(now)) } catch { /* ignore */ } return }
      const news = now.filter(id => !seen!.includes(id))
      setFresh(ACHIEVEMENTS.filter(a => news.includes(a.id)))
    })
  }, [uid, loc.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const turn = useAttention('achievement', fresh.length > 0)
  useEffect(() => { if (turn) setOpen(true) }, [turn])

  const close = () => {
    if (uid) try {
      const seen: string[] = JSON.parse(localStorage.getItem(SEEN_KEY(uid)) || '[]')
      localStorage.setItem(SEEN_KEY(uid), JSON.stringify([...new Set([...seen, ...fresh.map(a => a.id)])]))
    } catch { /* ignore */ }
    setOpen(false); setFresh([])
  }

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', esc)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !fresh.length) return null
  const a = fresh[0]
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="Nova conquista">
      <div className="absolute inset-0 bg-black/50 animate-in" onClick={close} />
      <div className="pop-in relative w-full max-w-sm overflow-hidden rounded-[22px] bg-surface px-6 pb-6 pt-8 text-center shadow-2xl dark:bg-neutral-900">
        <Confetti />
        <div className="relative mx-auto grid size-[120px] place-items-center">
          <div className="absolute inset-0 rounded-full opacity-30 blur-2xl" style={{ background: a.color }} />
          <span className="badge-pop relative grid size-24 place-items-center rounded-full text-white shadow-xl" style={{ background: a.color }}>
            <a.icon className="size-11" strokeWidth={2.2} />
          </span>
        </div>
        <div className="mt-5 inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wide text-brand-orange"><Sparkles className="size-3.5" />{fresh.length > 1 ? `${fresh.length} novas conquistas` : 'Nova conquista'}</div>
        <h2 className="mt-1 text-[23px] font-bold tracking-tight text-neutral-900 dark:text-white">{a.title}</h2>
        <p className="mt-1 text-[15px] text-neutral-600 dark:text-neutral-400">{a.text}</p>
        {fresh.length > 1 && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {fresh.slice(1).map(x => <span key={x.id} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ background: `${x.color}1f`, color: x.color }}><x.icon className="size-3.5" />{x.title}</span>)}
          </div>
        )}
        <button onClick={close} className="press mt-6 h-12 w-full rounded-[14px] bg-accent-600 text-[16px] font-semibold text-white">Valeu!</button>
      </div>
    </div>,
    document.body,
  )
}

const CONFETTI_COLORS = ['#fe811e', '#1a9ca9', '#34c759', '#ff2d55', '#5856d6', '#ffcc00']
function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden" aria-hidden>
      {Array.from({ length: 26 }).map((_, i) => (
        <span key={i} className="confetti absolute top-[-10px] block h-2.5 w-1.5 rounded-[2px]"
          style={{ left: `${(i * 37) % 100}%`, background: CONFETTI_COLORS[i % CONFETTI_COLORS.length], animationDelay: `${(i % 7) * 0.09}s`, '--drift': `${((i * 53) % 60) - 30}px` } as React.CSSProperties} />
      ))}
    </div>
  )
}
