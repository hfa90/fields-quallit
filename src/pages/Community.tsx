import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { HandHelping, Trophy, Activity, Plus, ArrowBigUp, MessageSquare, CheckCircle2, FileText, Users, BookOpen, Award } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Category, RequestItem, UserStats } from '../lib/types'
import { cn, errMsg, level, timeAgo } from '../lib/utils'
import { Avatar, Button, CategoryIcon, Empty, Modal, Spinner, inputCls, labelCls, textareaCls } from '../components/ui'
import { GapsWall } from '../components/Engagement'

type Tab = 'pedidos' | 'ranking' | 'atividade'
const TABS: [Tab, string, typeof Trophy][] = [['pedidos', 'Pedidos', HandHelping], ['ranking', 'Ranking', Trophy], ['atividade', 'Atividade', Activity]]

export const REQ_SELECT = '*, author:kb_profiles!kb_requests_user_id_fkey(full_name,email,avatar_url), category:kb_categories(name,color,icon), tutorial:kb_tutorials(title,short_code), votes:kb_request_votes(user_id), comments:kb_comments(count)'

export function LevelBadge({ points, className }: { points: number; className?: string }) {
  const l = level(points)
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-px text-[11px] font-semibold', className)} style={{ color: l.color, background: `${l.color}1a` }}><Award className="size-3" />{l.name}</span>
}

export default function Community() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('aba') as Tab) || 'pedidos'
  const pedir = params.get('pedir')
  const [stats, setStats] = useState<{ tutorials: number; members: number; answered: number } | null>(null)
  const [ask, setAsk] = useState<string | null>(pedir)

  useEffect(() => { if (pedir) setAsk(pedir) }, [pedir])
  useEffect(() => {
    Promise.all([
      supabase.from('kb_tutorials').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('kb_profiles').select('id', { count: 'exact', head: true }).in('role', ['admin', 'field_admin', 'field']),
      supabase.from('kb_requests').select('id', { count: 'exact', head: true }).eq('status', 'answered'),
    ]).then(([a, b, c]) => setStats({ tutorials: a.count ?? 0, members: b.count ?? 0, answered: c.count ?? 0 }))
  }, [])

  return (
    <div className="space-y-6 fade-up">
      <div className="flex items-end justify-between gap-3 pt-1">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-neutral-900 dark:text-white">Comunidade</h1>
          <p className="text-[15px] text-neutral-500">Um ajuda o outro. Peça, responda e compartilhe o que você sabe.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[[BookOpen, 'Tutoriais', stats?.tutorials], [Users, 'Fields', stats?.members], [CheckCircle2, 'Pedidos atendidos', stats?.answered]].map(([I, l, n], i) => {
          const Icon = I as typeof BookOpen
          return (
            <div key={i} className="card p-3.5 sm:p-4">
              <Icon className="size-5 text-accent-600" />
              <div className="mt-2 text-[24px] font-bold tabular-nums tracking-tight text-neutral-900 dark:text-white">{(n as number | undefined) ?? '–'}</div>
              <div className="text-[12px] text-neutral-500 sm:text-[13px]">{l as string}</div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-[9px] bg-neutral-900/[.06] p-0.5 dark:bg-white/10">
          {TABS.map(([k, l, I]) => (
            <button key={k} onClick={() => setParams(k === 'pedidos' ? {} : { aba: k }, { replace: true })}
              className={cn('inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3.5 text-[13px] font-medium transition',
                tab === k ? 'bg-surface text-neutral-900 shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-neutral-600 dark:text-white' : 'text-neutral-600 dark:text-neutral-300')}>
              <I className="size-3.5" />{l}
            </button>
          ))}
        </div>
        {tab === 'pedidos' && <Button onClick={() => setAsk('')} className="bg-brand-orange hover:bg-brand-orange-dark dark:bg-brand-orange"><Plus className="size-4" />Pedir um tutorial</Button>}
      </div>

      {tab === 'pedidos' && <><GapsWall /><h2 className="px-1 pt-2 text-[20px] font-bold tracking-tight text-neutral-900 dark:text-white">Pedidos de tutorial</h2><Requests /></>}
      {tab === 'ranking' && <Ranking />}
      {tab === 'atividade' && <Feed />}

      <NewRequest initial={ask} onClose={() => { setAsk(null); if (pedir) setParams({}, { replace: true }) }} />
    </div>
  )
}

function NewRequest({ initial, onClose }: { initial: string | null; onClose: () => void }) {
  const nav = useNavigate()
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [cat, setCat] = useState('')
  const [cats, setCats] = useState<Category[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (initial === null) return
    setTitle(initial ? `Como ${initial}?` : ''); setDetails(''); setCat('')
    supabase.from('kb_categories').select('*').order('sort_order').then(({ data }) => setCats(data ?? []))
  }, [initial])
  const save = async () => {
    if (title.trim().length < 5) return toast.error('Descreva o pedido em pelo menos 5 caracteres')
    setBusy(true)
    const { data, error } = await supabase.from('kb_requests').insert({ title: title.trim(), details: details.trim() || null, category_id: cat || null }).select('id').single()
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success('Pedido publicado! Quem segue a categoria foi avisado.')
    onClose(); nav(`/comunidade/pedido/${data.id}`)
  }
  return (
    <Modal open={initial !== null} onClose={onClose} title="Pedir um tutorial">
      <div className="space-y-4">
        <p className="text-[14px] text-neutral-500">Não achou o que precisava? Descreva a situação e alguém da comunidade pode documentar.</p>
        <div><label className={labelCls}>O que você precisa?</label><input autoFocus className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Como configurar a impressora Zebra na rede?" maxLength={200} /></div>
        <div><label className={labelCls}>Detalhes (opcional)</label><textarea className={cn(textareaCls, 'resize-none')} rows={3} value={details} onChange={e => setDetails(e.target.value)} placeholder="Modelo, sistema, mensagem de erro, o que você já tentou…" /></div>
        <div><label className={labelCls}>Categoria</label>
          <select className={inputCls} value={cat} onChange={e => setCat(e.target.value)}>
            <option value="">Sem categoria</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Button className="h-11 w-full" loading={busy} onClick={save}>Publicar pedido</Button>
      </div>
    </Modal>
  )
}

function Requests() {
  const { profile } = useAuth()
  const [filter, setFilter] = useState<'open' | 'answered'>('open')
  const [items, setItems] = useState<RequestItem[] | null>(null)
  const load = () => supabase.from('kb_requests').select(REQ_SELECT).eq('status', filter).order('created_at', { ascending: false }).limit(100)
    .then(({ data }) => setItems(((data as RequestItem[]) ?? []).sort((a, b) => filter === 'open' ? (b.votes?.length ?? 0) - (a.votes?.length ?? 0) : 0)))
  useEffect(() => { setItems(null); load() }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const vote = async (r: RequestItem) => {
    const voted = r.votes?.some(v => v.user_id === profile?.id)
    const { error } = voted
      ? await supabase.from('kb_request_votes').delete().eq('request_id', r.id).eq('user_id', profile!.id)
      : await supabase.from('kb_request_votes').insert({ request_id: r.id })
    if (error) return toast.error(errMsg(error))
    load()
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['open', 'answered'] as const).map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className={cn('h-8 rounded-full px-3.5 text-[13px] font-medium', filter === k ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-surface text-neutral-700 shadow-[0_0_0_0.5px_rgb(0_0_0/0.12)] dark:bg-neutral-900 dark:text-neutral-300')}>
            {k === 'open' ? 'Em aberto' : 'Atendidos'}
          </button>
        ))}
      </div>
      {!items ? <Spinner /> : items.length === 0 ? (
        <Empty icon={<HandHelping className="size-12" strokeWidth={1.4} />} title={filter === 'open' ? 'Nenhum pedido em aberto' : 'Nenhum pedido atendido ainda'}>
          {filter === 'open' && 'Precisa de um tutorial que ainda não existe? Faça um pedido.'}
        </Empty>
      ) : items.map(r => <RequestCard key={r.id} r={r} me={profile?.id} onVote={() => vote(r)} />)}
    </div>
  )
}

export function RequestCard({ r, me, onVote }: { r: RequestItem; me?: string; onVote: () => void }) {
  const voted = r.votes?.some(v => v.user_id === me)
  const n = r.votes?.length ?? 0
  return (
    <div className="card flex gap-3 p-4">
      <button onClick={onVote} disabled={r.status !== 'open'} title={voted ? 'Remover meu voto' : 'Eu também preciso'}
        className={cn('press flex w-12 shrink-0 flex-col items-center justify-center rounded-[10px] py-1.5 text-[13px] font-semibold tabular-nums',
          voted ? 'bg-brand-orange text-white' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300')}>
        <ArrowBigUp className="size-5" fill={voted ? 'currentColor' : 'none'} />{n}
      </button>
      <Link to={`/comunidade/pedido/${r.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium">
          {r.category && <span className="inline-flex items-center gap-1" style={{ color: r.category.color }}><CategoryIcon name={r.category.icon} className="size-3.5" />{r.category.name}</span>}
          {r.status === 'answered' && <span className="inline-flex items-center gap-1 text-[#248a3d] dark:text-[#30d158]"><CheckCircle2 className="size-3.5" />Atendido</span>}
        </div>
        <h3 className="mt-1 text-[16px] font-semibold leading-snug text-neutral-900 dark:text-white">{r.title}</h3>
        {r.details && <p className="mt-0.5 text-[14px] text-neutral-500 line-clamp-2">{r.details}</p>}
        {r.tutorial && <p className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-accent-600 dark:text-accent-400"><FileText className="size-3.5" />{r.tutorial.title}</p>}
        <div className="mt-2 flex items-center gap-2 text-[12px] text-neutral-500">
          <Avatar name={r.author?.full_name} email={r.author?.email} url={r.author?.avatar_url} size={18} />
          <span className="truncate">{r.author?.full_name}</span><span>·</span><span>{timeAgo(r.created_at)}</span>
          <span className="ml-auto inline-flex items-center gap-1"><MessageSquare className="size-3.5" />{r.comments?.[0]?.count ?? 0}</span>
        </div>
      </Link>
    </div>
  )
}

function Ranking() {
  const [rows, setRows] = useState<UserStats[] | null>(null)
  useEffect(() => {
    supabase.from('kb_user_stats').select('*').order('points', { ascending: false }).limit(50).then(({ data }) => setRows((data as UserStats[]) ?? []))
  }, [])
  if (!rows) return <Spinner />
  const medal = ['#f5b301', '#a1a1aa', '#c2793b']
  return (
    <div className="space-y-4">
      <div className="card divide-y divide-neutral-200/70 overflow-hidden dark:divide-neutral-800">
        {rows.map((u, i) => (
          <Link key={u.user_id} to={`/pessoa/${u.user_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-900/[.02] dark:hover:bg-white/[.03]">
            <span className="w-6 text-center text-[15px] font-bold tabular-nums" style={{ color: medal[i] ?? '#8e8e93' }}>{i < 3 ? <Trophy className="mx-auto size-5" /> : i + 1}</span>
            <Avatar name={u.full_name} email={u.email} url={u.avatar_url} size={38} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold text-neutral-900 dark:text-white">{u.full_name}</span><LevelBadge points={u.points} /></div>
              <div className="text-[12px] text-neutral-500">{u.tutorials} tutoriais · {u.helpful_received} “funcionou” · {u.requests_answered} pedidos atendidos</div>
            </div>
            <div className="text-right">
              <div className="text-[17px] font-bold tabular-nums text-accent-600 dark:text-accent-400">{u.points}</div>
              <div className="text-[11px] text-neutral-500">pontos</div>
            </div>
          </Link>
        ))}
      </div>
      <div className="card p-4 text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-400">
        <div className="mb-1 font-semibold text-neutral-900 dark:text-white">Como funcionam os pontos</div>
        Tutorial publicado <b>+10</b> · alguém marca “funcionou” <b>+3</b> · pedido atendido <b>+15</b> · comentário <b>+1</b> · a cada 10 leituras dos seus tutoriais <b>+1</b>.
        <div className="mt-2 flex flex-wrap gap-2">
          {[0, 50, 150, 400].map(p => <span key={p} className="inline-flex items-center gap-1"><LevelBadge points={p} /><span>{p}+</span></span>)}
        </div>
      </div>
    </div>
  )
}

interface FeedItem { kind: 'tutorial' | 'comment' | 'request'; at: string; who: { id: string; name: string | null; avatar: string | null; email?: string }; text: string; link: string; title: string }

function Feed() {
  const [items, setItems] = useState<FeedItem[] | null>(null)
  useEffect(() => {
    Promise.all([
      supabase.from('kb_tutorials_list').select('short_code,title,author_id,author_name,author_avatar,created_at').eq('status', 'published').order('created_at', { ascending: false }).limit(20),
      supabase.from('kb_comments').select('body,kind,created_at,user_id,author:kb_profiles!kb_comments_user_id_fkey(full_name,avatar_url,email),tutorial:kb_tutorials(title,short_code),request:kb_requests(id,title)').order('created_at', { ascending: false }).limit(20),
      supabase.from('kb_requests').select('id,title,created_at,user_id,author:kb_profiles!kb_requests_user_id_fkey(full_name,avatar_url,email)').order('created_at', { ascending: false }).limit(20),
    ]).then(([t, c, r]) => {
      const out: FeedItem[] = []
      t.data?.forEach(x => out.push({ kind: 'tutorial', at: x.created_at, who: { id: x.author_id, name: x.author_name, avatar: x.author_avatar }, text: 'publicou', title: x.title, link: `/t/${x.short_code}` }))
      ;(c.data as unknown as { body: string; kind: string; created_at: string; user_id: string; author: { full_name: string; avatar_url: string; email: string } | null; tutorial: { title: string; short_code: string } | null; request: { id: string; title: string } | null }[] ?? []).forEach(x => out.push({
        kind: 'comment', at: x.created_at, who: { id: x.user_id, name: x.author?.full_name ?? null, avatar: x.author?.avatar_url ?? null, email: x.author?.email },
        text: x.kind === 'outdated' ? 'reportou passo desatualizado em' : x.kind === 'tip' ? 'deixou uma dica em' : x.kind === 'question' ? 'perguntou em' : 'comentou em',
        title: x.tutorial?.title ?? x.request?.title ?? '', link: x.tutorial ? `/t/${x.tutorial.short_code}#comentarios` : `/comunidade/pedido/${x.request?.id}`,
      }))
      ;(r.data as unknown as { id: string; title: string; created_at: string; user_id: string; author: { full_name: string; avatar_url: string; email: string } | null }[] ?? []).forEach(x => out.push({
        kind: 'request', at: x.created_at, who: { id: x.user_id, name: x.author?.full_name ?? null, avatar: x.author?.avatar_url ?? null, email: x.author?.email },
        text: 'pediu', title: x.title, link: `/comunidade/pedido/${x.id}`,
      }))
      setItems(out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40))
    })
  }, [])
  if (!items) return <Spinner />
  if (!items.length) return <Empty icon={<Activity className="size-12" strokeWidth={1.4} />} title="Sem atividade ainda" />
  const ICON = { tutorial: FileText, comment: MessageSquare, request: HandHelping }
  return (
    <div className="card divide-y divide-neutral-200/70 overflow-hidden dark:divide-neutral-800">
      {items.map((x, i) => {
        const I = ICON[x.kind]
        return (
          <Link key={i} to={x.link.split('#')[0]} state={{ inApp: true, hash: x.link.split('#')[1] }} className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-900/[.02] dark:hover:bg-white/[.03]">
            <span className="relative">
              <Avatar name={x.who.name} email={x.who.email} url={x.who.avatar} size={34} />
              <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-surface text-accent-600 ring-1 ring-black/5 dark:bg-neutral-800"><I className="size-2.5" /></span>
            </span>
            <span className="min-w-0 flex-1 text-[14px] leading-snug text-neutral-600 dark:text-neutral-400">
              <b className="font-semibold text-neutral-900 dark:text-white">{x.who.name}</b> {x.text} <span className="font-medium text-neutral-900 dark:text-white">{x.title}</span>
              <span className="mt-0.5 block text-[12px] text-neutral-400">{timeAgo(x.at)}</span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}
