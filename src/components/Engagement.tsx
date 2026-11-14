import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, Zap, FileText, Users, Eye, ThumbsUp, Building2, HandHelping, Search, ChevronRight, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { cn, errMsg, timeAgo } from '../lib/utils'
import { Avatar, Button, Modal, textareaCls } from './ui'

// ---------------------------------------------------------------- "O que você quer compartilhar?"
const openers = new Set<() => void>()
export function openNewChooser() { openers.forEach(o => o()) }

export function NewChooser() {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  useEffect(() => { const o = () => setOpen(true); openers.add(o); return () => { openers.delete(o) } }, [])
  const go = (to: string) => { setOpen(false); nav(to) }
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="O que você quer compartilhar?">
      <div className="space-y-3">
        <button onClick={() => go('/dica')} className="press flex w-full items-center gap-4 rounded-[14px] bg-brand-orange/10 p-4 text-left ring-1 ring-brand-orange/30">
          <span className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-brand-orange text-white"><Zap className="size-6" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-neutral-900 dark:text-white">Dica rápida <span className="ml-1 rounded-md bg-brand-orange/20 px-1.5 py-px text-[11px] font-semibold text-brand-orange-dark">30 segundos</span></span>
            <span className="block text-[13px] text-neutral-500">Resolvi um problema: conto o quê e como, com foto ou por voz</span>
          </span>
          <ChevronRight className="size-5 text-neutral-400" />
        </button>
        <button onClick={() => go('/novo')} className="press flex w-full items-center gap-4 rounded-[14px] bg-neutral-100 p-4 text-left dark:bg-neutral-800">
          <span className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-accent-600 text-white"><FileText className="size-6" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-neutral-900 dark:text-white">Tutorial completo</span>
            <span className="block text-[13px] text-neutral-500">Passo a passo detalhado, anexos, modelos e importação de Word/PDF</span>
          </span>
          <ChevronRight className="size-5 text-neutral-400" />
        </button>
      </div>
    </Modal>
  )
}

/** Chamada na Biblioteca para incentivar a contribuição */
// "Resolveu algo hoje?" aparece só na primeira abertura do dia (decidido uma vez por carregamento)
let calloutToday: boolean | null = null
function shouldShowCallout() {
  if (calloutToday !== null) return calloutToday
  const today = new Date().toLocaleDateString('pt-BR')
  try {
    calloutToday = localStorage.getItem('fq-callout-day') !== today
    if (calloutToday) localStorage.setItem('fq-callout-day', today)
  } catch { calloutToday = true }
  return calloutToday
}

export function ShareCallout() {
  if (!shouldShowCallout()) return null
  return (
    <button onClick={openNewChooser} className="press group flex w-full items-center gap-4 rounded-[16px] bg-surface p-4 text-left ring-1 ring-brand-orange/30 dark:bg-neutral-900">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-orange/15 text-brand-orange"><Zap className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold text-neutral-900 dark:text-white">Resolveu algo hoje?</span>
        <span className="block text-[13px] text-neutral-500">Compartilhe em 30 segundos e ajude colegas de todos os CDs.</span>
      </span>
      <span className="hidden h-9 items-center rounded-full bg-brand-orange px-4 text-[14px] font-semibold text-white sm:inline-flex">Compartilhar</span>
      <ChevronRight className="size-5 text-neutral-400 sm:hidden" />
    </button>
  )
}

// ---------------------------------------------------------------- Agradecimentos
interface Thanks { user_id: string; message: string | null; created_at: string; user?: { full_name: string | null; email: string; avatar_url: string | null } | null }

export function ThanksBox({ tutorialId, authorId, authorName }: { tutorialId: string; authorId: string; authorName?: string | null }) {
  const { profile } = useAuth()
  const [items, setItems] = useState<Thanks[] | null>(null)
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const mine = items?.find(t => t.user_id === profile?.id)
  const isAuthor = profile?.id === authorId

  const load = () => supabase.from('kb_thanks').select('user_id,message,created_at,user:kb_profiles(full_name,email,avatar_url)')
    .eq('tutorial_id', tutorialId).order('created_at', { ascending: false })
    .then(({ data }) => setItems((data as unknown as Thanks[]) ?? []))
  useEffect(() => { load() }, [tutorialId]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    setBusy(true)
    const { error } = await supabase.from('kb_thanks').upsert({ tutorial_id: tutorialId, user_id: profile!.id, message: msg.trim() || null })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    setOpen(false); setMsg('')
    toast.success(`${authorName?.split(' ')[0] ?? 'O autor'} vai saber que ajudou você 💚`)
    load()
  }

  return (
    <div className="card p-5">
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#ff2d55]/10 text-[#ff2d55]"><Heart className="size-5" fill={mine ? 'currentColor' : 'none'} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold text-neutral-900 dark:text-white">
            {isAuthor ? 'Agradecimentos recebidos' : mine ? 'Você agradeceu 💚' : 'Este conteúdo te ajudou?'}
          </div>
          <div className="text-[13px] text-neutral-500">
            {items && items.length > 0
              ? `${items.length} ${items.length === 1 ? 'colega agradeceu' : 'colegas agradeceram'}${isAuthor ? ' pelo seu conhecimento' : ''}`
              : isAuthor ? 'Quando alguém agradecer, aparece aqui.' : `Diga obrigado a ${authorName?.split(' ')[0] ?? 'quem compartilhou'} — é o que mantém a biblioteca viva.`}
          </div>
        </div>
        {!isAuthor && !mine && (
          <Button onClick={() => setOpen(true)} className="bg-[#ff2d55] hover:bg-[#e0264b] dark:bg-[#ff2d55]"><Heart className="size-4" />Obrigado!</Button>
        )}
      </div>
      {items && items.some(t => t.message) && (
        <ul className="mt-4 space-y-2 border-t border-neutral-200/70 pt-4 dark:border-neutral-800">
          {items.filter(t => t.message).slice(0, 5).map(t => (
            <li key={t.user_id} className="flex items-start gap-2.5">
              <Avatar name={t.user?.full_name} email={t.user?.email} url={t.user?.avatar_url} size={26} />
              <div className="min-w-0 flex-1 rounded-[12px] bg-neutral-100 px-3 py-2 text-[14px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                “{t.message}”
                <div className="mt-0.5 text-[11px] text-neutral-400">{t.user?.full_name} · {timeAgo(t.created_at)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={`Agradecer a ${authorName ?? 'quem compartilhou'}`}>
        <div className="space-y-4">
          <textarea autoFocus className={cn(textareaCls, 'resize-none')} rows={3} maxLength={280} value={msg} onChange={e => setMsg(e.target.value)}
            placeholder="Mensagem opcional — ex.: “Salvou meu plantão no CD!”" />
          <div className="flex flex-wrap gap-1.5">
            {['Salvou meu dia!', 'Resolveu na hora 👏', 'Muito bem explicado', 'Economizou horas de trabalho'].map(s => (
              <button key={s} type="button" onClick={() => setMsg(s)} className="rounded-full bg-neutral-100 px-3 py-1 text-[13px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{s}</button>
            ))}
          </div>
          <Button className="h-11 w-full bg-[#ff2d55] hover:bg-[#e0264b] dark:bg-[#ff2d55]" loading={busy} onClick={send}><Heart className="size-4" />Enviar agradecimento</Button>
        </div>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------- Impacto
interface Impact { tutorials: number; views: number; people: number; cds: string[]; helpful: number; thanks: number; cd: string | null }

export function ImpactCard({ userId, me }: { userId: string; me?: boolean }) {
  const [all, setAll] = useState<Impact | null>(null)
  const [week, setWeek] = useState<Impact | null>(null)
  const [thanks, setThanks] = useState<{ message: string; created_at: string; user: { full_name: string | null } | null; tutorial: { title: string; short_code: string } | null }[]>([])

  useEffect(() => {
    supabase.rpc('kb_impact', { p_user: userId }).then(({ data }) => setAll(data as Impact))
    supabase.rpc('kb_impact', { p_user: userId, p_days: 7 }).then(({ data }) => setWeek(data as Impact))
    supabase.from('kb_thanks').select('message,created_at,user:kb_profiles(full_name),tutorial:kb_tutorials!inner(title,short_code,author_id)')
      .eq('tutorial.author_id', userId).not('message', 'is', null).order('created_at', { ascending: false }).limit(6)
      .then(({ data }) => setThanks((data as unknown as typeof thanks) ?? []))
  }, [userId])

  if (!all || all.tutorials === undefined) return null
  const stat = [
    [Users, all.people, all.people === 1 ? 'colega ajudado' : 'colegas ajudados', '#1a9ca9'],
    [Building2, all.cds.length, all.cds.length === 1 ? 'CD alcançado' : 'CDs alcançados', '#5856d6'],
    [ThumbsUp, all.helpful, '“funcionou”', '#34c759'],
    [Heart, all.thanks, all.thanks === 1 ? 'agradecimento' : 'agradecimentos', '#ff2d55'],
  ] as const
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-neutral-200/70 px-5 py-3.5 dark:border-neutral-800">
        <Sparkles className="size-4 text-brand-orange" />
        <h2 className="text-[15px] font-semibold text-neutral-900 dark:text-white">{me ? 'Seu impacto' : 'Impacto na comunidade'}</h2>
        {all.cd && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-neutral-900/[.05] px-2.5 py-0.5 text-[12px] font-medium text-neutral-600 dark:bg-white/10 dark:text-neutral-300"><Building2 className="size-3" />{all.cd}</span>}
      </div>
      {all.tutorials === 0 ? (
        <div className="px-5 py-6 text-center text-[14px] text-neutral-500">
          {me ? <>Você ainda não compartilhou. <Link to="/dica" className="font-medium text-brand-orange">Que tal uma dica rápida?</Link></> : 'Ainda não compartilhou conteúdo.'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px bg-neutral-200/70 sm:grid-cols-4 dark:bg-neutral-800">
            {stat.map(([I, n, l, c]) => (
              <div key={l} className="bg-surface px-4 py-4 dark:bg-neutral-900">
                <I className="size-4" style={{ color: c }} />
                <div className="mt-1.5 text-[26px] font-bold tabular-nums tracking-tight text-neutral-900 dark:text-white">{n}</div>
                <div className="text-[12px] text-neutral-500">{l}</div>
              </div>
            ))}
          </div>
          {week && (week.views > 0 || week.thanks > 0) && (
            <div className="flex items-center gap-2 bg-accent-500/[.06] px-5 py-3 text-[13px] text-neutral-700 dark:text-neutral-300">
              <Eye className="size-4 shrink-0 text-accent-600" />
              Nos últimos 7 dias: <b>{week.views}</b> leitura{week.views === 1 ? '' : 's'} por <b>{week.people}</b> colega{week.people === 1 ? '' : 's'}{week.thanks > 0 && <> e <b>{week.thanks}</b> agradecimento{week.thanks === 1 ? '' : 's'}</>}.
            </div>
          )}
          {all.cds.length > 0 && <div className="px-5 py-3 text-[12px] text-neutral-500">Ajudou colegas de: {all.cds.join(', ')}</div>}
          {thanks.length > 0 && (
            <ul className="space-y-2 border-t border-neutral-200/70 px-5 py-4 dark:border-neutral-800">
              {thanks.map((t, i) => (
                <li key={i} className="text-[14px] text-neutral-700 dark:text-neutral-300">
                  <Heart className="mr-1.5 inline size-3.5 text-[#ff2d55]" fill="currentColor" />“{t.message}”
                  <span className="text-[12px] text-neutral-400"> — {t.user?.full_name}{t.tutorial && <>, em <Link to={`/t/${t.tutorial.short_code}`} className="text-accent-600">{t.tutorial.title}</Link></>}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- Procuraram e não acharam
interface Gap { query: string; people: number; searches: number; last_at: string }

export function useGaps(days = 60) {
  const [gaps, setGaps] = useState<Gap[] | null>(null)
  useEffect(() => { supabase.rpc('kb_search_gaps', { p_days: days }).then(({ data }) => setGaps((data as Gap[]) ?? [])) }, [days])
  return gaps
}

export function GapCard({ g, compact }: { g: Gap; compact?: boolean }) {
  const nav = useNavigate()
  return (
    <div className={cn('card flex flex-col p-4', compact && 'w-[260px] shrink-0')}>
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-brand-orange-dark">
        <Search className="size-3.5" />{g.people > 1 ? `${g.people} colegas procuraram` : 'Um colega procurou'} · {timeAgo(g.last_at)}
      </div>
      <div className="mt-1.5 text-[16px] font-semibold leading-snug text-neutral-900 line-clamp-2 dark:text-white">“{g.query}”</div>
      <div className="mt-auto flex gap-2 pt-3">
        <Button size="sm" className="flex-1 bg-brand-orange hover:bg-brand-orange-dark dark:bg-brand-orange" onClick={() => nav(`/dica?problema=${encodeURIComponent(g.query)}`)}>
          <Zap className="size-3.5" />Eu sei resolver
        </Button>
        {!compact && <Button size="sm" variant="secondary" onClick={() => nav(`/comunidade?pedir=${encodeURIComponent(g.query)}`)}><HandHelping className="size-3.5" />Pedir</Button>}
      </div>
    </div>
  )
}

export function GapsWall() {
  const gaps = useGaps()
  if (!gaps) return null
  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-neutral-900 dark:text-white"><Search className="size-5 text-brand-orange" />Procuraram e não acharam</h2>
        <p className="text-[14px] text-neutral-500">Buscas dos colegas que ainda não têm resposta na biblioteca. Sabe resolver? Compartilhe em 30 segundos.</p>
      </div>
      {gaps.length === 0 ? (
        <div className="card p-5 text-center text-[14px] text-neutral-500">Nenhuma busca sem resposta nos últimos 60 dias. A biblioteca está cobrindo tudo! 🎉</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{gaps.map(g => <GapCard key={g.query} g={g} />)}</div>
      )}
    </section>
  )
}
