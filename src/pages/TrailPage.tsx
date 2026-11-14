import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, CheckCircle2, ArrowUp, ArrowDown, Trash2, Plus, Pencil, Route, Users, Search, Play } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { cn, errMsg, timeAgo } from '../lib/utils'
import { Avatar, Button, CategoryIcon, Modal, inputCls, labelCls, textareaCls, CardsSkeleton, PageSkeleton } from '../components/ui'
import NotFound from './NotFound'

export interface Trail { id: string; title: string; description: string | null; color: string; icon: string; status: 'draft' | 'published'; created_at: string }
interface Item { id: string; tutorial_id: string; position: number; note: string | null; tutorial: { title: string; short_code: string; summary: string | null; category: { name: string; color: string; icon: string } | null } | null }
interface Progress { tutorial_id: string; user_id: string; completed_at: string; user?: { full_name: string | null; email: string; avatar_url: string | null } | null }

const ITEM_SELECT = 'id,tutorial_id,position,note,tutorial:kb_tutorials(title,short_code,summary,category:kb_categories(name,color,icon))'

/** Usado na página do tutorial quando aberto a partir de uma trilha (?trilha=ID) */
export function useTrailNav(tutorialId?: string) {
  const [sp] = useSearchParams()
  const trailId = sp.get('trilha')
  const { profile } = useAuth()
  const [data, setData] = useState<{ trail: Trail; items: Item[]; done: Set<string> } | null>(null)

  useEffect(() => {
    if (!trailId || !tutorialId) { setData(null); return }
    Promise.all([
      supabase.from('kb_trails').select('*').eq('id', trailId).maybeSingle(),
      supabase.from('kb_trail_items').select(ITEM_SELECT).eq('trail_id', trailId).order('position'),
      supabase.from('kb_trail_progress').select('tutorial_id').eq('trail_id', trailId).eq('user_id', profile!.id),
    ]).then(([t, i, p]) => {
      if (!t.data) return
      setData({ trail: t.data as Trail, items: (i.data as unknown as Item[]) ?? [], done: new Set((p.data ?? []).map(r => r.tutorial_id)) })
    })
  }, [trailId, tutorialId, profile])

  const complete = useCallback(async () => {
    if (!data || !tutorialId || data.done.has(tutorialId)) return
    const { error } = await supabase.from('kb_trail_progress').insert({ trail_id: data.trail.id, tutorial_id: tutorialId })
    if (error && !error.message.includes('duplicate')) { toast.error(errMsg(error)); return }
    const done = new Set(data.done).add(tutorialId)
    setData({ ...data, done })
    if (done.size === data.items.length) toast.success('Trilha concluída! 🎓', { description: data.trail.title })
  }, [data, tutorialId])

  if (!data || !tutorialId) return null
  const index = data.items.findIndex(i => i.tutorial_id === tutorialId)
  if (index < 0) return null
  return {
    id: data.trail.id, title: data.trail.title, color: data.trail.color,
    index, total: data.items.length, done: data.done.size, completed: data.done.has(tutorialId),
    next: data.items[index + 1]?.tutorial?.short_code ?? null, complete,
  }
}

export default function TrailPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { profile, isModerator } = useAuth()
  const [trail, setTrail] = useState<Trail | null | undefined>(undefined)
  const [items, setItems] = useState<Item[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [edit, setEdit] = useState(false)
  const [picker, setPicker] = useState(false)

  const load = useCallback(async () => {
    const [t, i, p] = await Promise.all([
      supabase.from('kb_trails').select('*').eq('id', id).maybeSingle(),
      supabase.from('kb_trail_items').select(ITEM_SELECT).eq('trail_id', id).order('position'),
      supabase.from('kb_trail_progress').select('tutorial_id,user_id,completed_at,user:kb_profiles(full_name,email,avatar_url)').eq('trail_id', id),
    ])
    setTrail((t.data as Trail) ?? null)
    setItems((i.data as unknown as Item[]) ?? [])
    setProgress((p.data as unknown as Progress[]) ?? [])
  }, [id])
  useEffect(() => { load() }, [load])

  const mine = useMemo(() => new Set(progress.filter(p => p.user_id === profile?.id).map(p => p.tutorial_id)), [progress, profile])
  const people = useMemo(() => {
    const m = new Map<string, { user: Progress['user']; n: number; last: string }>()
    progress.forEach(p => {
      const cur = m.get(p.user_id) ?? { user: p.user, n: 0, last: p.completed_at }
      m.set(p.user_id, { user: p.user, n: cur.n + 1, last: p.completed_at > cur.last ? p.completed_at : cur.last })
    })
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n)
  }, [progress])

  if (trail === undefined) return <PageSkeleton />
  if (trail === null) return <NotFound message="Trilha não encontrada" />

  const pct = items.length ? Math.round((mine.size / items.length) * 100) : 0
  const nextItem = items.find(i => !mine.has(i.tutorial_id)) ?? items[0]

  const toggleDone = async (tid: string) => {
    if (mine.has(tid)) await supabase.from('kb_trail_progress').delete().eq('trail_id', id).eq('tutorial_id', tid).eq('user_id', profile!.id)
    else await supabase.from('kb_trail_progress').insert({ trail_id: id, tutorial_id: tid })
    load()
  }
  const move = async (idx: number, dir: -1 | 1) => {
    const a = items[idx], b = items[idx + dir]
    if (!a || !b) return
    await Promise.all([
      supabase.from('kb_trail_items').update({ position: b.position }).eq('id', a.id),
      supabase.from('kb_trail_items').update({ position: a.position }).eq('id', b.id),
    ])
    load()
  }
  const removeItem = async (it: Item) => { await supabase.from('kb_trail_items').delete().eq('id', it.id); load() }
  const removeTrail = async () => {
    if (!confirm('Excluir esta trilha? O progresso das pessoas também será apagado.')) return
    const { error } = await supabase.from('kb_trails').delete().eq('id', id)
    if (error) return toast.error(errMsg(error))
    nav('/trilhas', { replace: true })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 fade-up">
      <button onClick={() => nav('/trilhas')} className="-ml-2 inline-flex h-9 items-center text-[17px] text-accent-600 dark:text-accent-400"><ChevronLeft className="size-6" strokeWidth={2.2} />Trilhas</button>

      <div className="card overflow-hidden">
        <div className="h-2" style={{ background: trail.color }} />
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-[14px] text-white" style={{ background: trail.color }}><CategoryIcon name={trail.icon} className="size-7" /></span>
            <div className="min-w-0 flex-1">
              {trail.status === 'draft' && <span className="text-[12px] font-semibold text-brand-orange">Rascunho — visível só para moderadores</span>}
              <h1 className="text-[24px] font-bold leading-tight tracking-tight text-neutral-900 dark:text-white">{trail.title}</h1>
              {trail.description && <p className="mt-1 text-[15px] text-neutral-500">{trail.description}</p>}
            </div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-[13px] text-neutral-500"><span>Seu progresso</span><span><b className="text-neutral-900 dark:text-white">{mine.size}</b> de {items.length} · {pct}%</span></div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: trail.color }} /></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {nextItem?.tutorial && (
              <Button onClick={() => nav(`/t/${nextItem.tutorial!.short_code}?trilha=${id}`)}><Play className="size-4" />{mine.size === 0 ? 'Começar trilha' : pct === 100 ? 'Rever trilha' : 'Continuar'}</Button>
            )}
            {isModerator && <Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="size-4" />Editar</Button>}
            {isModerator && <Button variant="secondary" onClick={() => setPicker(true)}><Plus className="size-4" />Adicionar tutorial</Button>}
          </div>
        </div>
      </div>

      <ol className="space-y-2">
        {items.map((it, i) => {
          const done = mine.has(it.tutorial_id)
          return (
            <li key={it.id} className="card flex items-center gap-3 p-3.5">
              <button onClick={() => toggleDone(it.tutorial_id)} title={done ? 'Marcar como não concluído' : 'Marcar como concluído'} className="shrink-0">
                {done ? <CheckCircle2 className="size-7 text-[#34c759]" fill="#34c75922" /> : <span className="grid size-7 place-items-center rounded-full border-2 border-neutral-300 text-[12px] font-semibold text-neutral-500 dark:border-neutral-600">{i + 1}</span>}
              </button>
              <Link to={`/t/${it.tutorial?.short_code}?trilha=${id}`} className="min-w-0 flex-1">
                <div className={cn('truncate text-[15px] font-semibold', done ? 'text-neutral-500 line-through decoration-neutral-300' : 'text-neutral-900 dark:text-white')}>{it.tutorial?.title ?? 'Tutorial removido'}</div>
                {it.tutorial?.category && <div className="flex items-center gap-1 text-[12px]" style={{ color: it.tutorial.category.color }}><CategoryIcon name={it.tutorial.category.icon} className="size-3" />{it.tutorial.category.name}</div>}
                {it.note && <div className="mt-0.5 text-[13px] text-neutral-500">{it.note}</div>}
              </Link>
              {isModerator && (
                <div className="flex shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 text-neutral-400 disabled:opacity-20"><ArrowUp className="size-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="p-1.5 text-neutral-400 disabled:opacity-20"><ArrowDown className="size-4" /></button>
                  <button onClick={() => removeItem(it)} className="p-1.5 text-neutral-400 hover:text-[#ff3b30]"><Trash2 className="size-4" /></button>
                </div>
              )}
            </li>
          )
        })}
        {items.length === 0 && <p className="px-1 text-[15px] text-neutral-500">Nenhum tutorial nesta trilha ainda.{isModerator && ' Toque em “Adicionar tutorial”.'}</p>}
      </ol>

      {people.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-[13px] font-medium uppercase tracking-wide text-neutral-500"><Users className="size-4" />Quem está fazendo · {people.length}</h2>
          <div className="card divide-y divide-neutral-200/70 overflow-hidden dark:divide-neutral-800">
            {people.map(([uid, p]) => (
              <Link key={uid} to={`/pessoa/${uid}`} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={p.user?.full_name} email={p.user?.email} url={p.user?.avatar_url} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-neutral-900 dark:text-white">{p.user?.full_name}</div>
                  <div className="text-[12px] text-neutral-500">{p.n === items.length ? 'Concluiu' : `${p.n} de ${items.length}`} · {timeAgo(p.last)}</div>
                </div>
                {p.n === items.length && <CheckCircle2 className="size-5 text-[#34c759]" />}
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"><div className="h-full rounded-full" style={{ width: `${(p.n / Math.max(1, items.length)) * 100}%`, background: trail.color }} /></div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {edit && <TrailForm trail={trail} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); load() }} onDelete={removeTrail} />}
      <TutorialPicker open={picker} onClose={() => setPicker(false)} exclude={new Set(items.map(i => i.tutorial_id))}
        onPick={async tid => {
          const pos = (items[items.length - 1]?.position ?? 0) + 1
          const { error } = await supabase.from('kb_trail_items').insert({ trail_id: id, tutorial_id: tid, position: pos })
          if (error) toast.error(errMsg(error)); else load()
        }} />
    </div>
  )
}

const COLORS = ['#1a9ca9', '#fe811e', '#007aff', '#af52de', '#34c759', '#ff3b30', '#5856d6', '#1c1c1e']

export function TrailForm({ trail, onClose, onSaved, onDelete }: { trail?: Trail; onClose: () => void; onSaved: (id: string) => void; onDelete?: () => void }) {
  const [title, setTitle] = useState(trail?.title ?? '')
  const [description, setDescription] = useState(trail?.description ?? '')
  const [color, setColor] = useState(trail?.color ?? COLORS[0])
  const [status, setStatus] = useState<Trail['status']>(trail?.status ?? 'draft')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (title.trim().length < 3) return toast.error('Dê um nome à trilha')
    setBusy(true)
    const payload = { title: title.trim(), description: description.trim() || null, color, status, icon: 'book-open' }
    const res = trail
      ? await supabase.from('kb_trails').update(payload).eq('id', trail.id).select('id').single()
      : await supabase.from('kb_trails').insert(payload).select('id').single()
    setBusy(false)
    if (res.error) return toast.error(errMsg(res.error))
    if (status === 'published' && trail?.status !== 'published') toast.success('Trilha publicada! Todos foram avisados.')
    onSaved(res.data.id)
  }
  return (
    <Modal open onClose={onClose} title={trail ? 'Editar trilha' : 'Nova trilha'}>
      <div className="space-y-4">
        <div><label className={labelCls}>Nome</label><input autoFocus className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Onboarding de novo field" maxLength={150} /></div>
        <div><label className={labelCls}>Descrição</label><textarea className={cn(textareaCls, 'resize-none')} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Para quem é e o que a pessoa vai aprender" /></div>
        <div><label className={labelCls}>Cor</label>
          <div className="flex gap-2">{COLORS.map(c => <button key={c} type="button" onClick={() => setColor(c)} className={cn('size-8 rounded-full ring-offset-2 dark:ring-offset-neutral-900', color === c && 'ring-2 ring-accent-500')} style={{ background: c }} />)}</div>
        </div>
        <div className="grid grid-cols-2 rounded-[9px] bg-neutral-900/[.06] p-0.5 dark:bg-white/10">
          {(['draft', 'published'] as const).map(s => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={cn('h-8 rounded-[7px] text-[13px] font-medium', status === s ? 'bg-surface text-neutral-900 shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-neutral-600 dark:text-white' : 'text-neutral-600 dark:text-neutral-300')}>
              {s === 'draft' ? 'Rascunho' : 'Publicada'}
            </button>
          ))}
        </div>
        <Button className="h-11 w-full" loading={busy} onClick={save}>Salvar</Button>
        {onDelete && <Button variant="ghost" className="w-full text-[#ff3b30]" onClick={onDelete}><Trash2 className="size-4" />Excluir trilha</Button>}
      </div>
    </Modal>
  )
}

function TutorialPicker({ open, onClose, onPick, exclude }: { open: boolean; onClose: () => void; onPick: (id: string) => Promise<void>; exclude: Set<string> }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<{ id: string; title: string; category_name: string | null }[]>([])
  useEffect(() => {
    if (!open) return
    let query = supabase.from('kb_tutorials_list').select('id,title,category_name').eq('status', 'published').order('title').limit(50)
    if (q.trim()) query = query.ilike('title', `%${q.trim()}%`)
    const t = setTimeout(() => query.then(({ data }) => setRows(data ?? [])), 200)
    return () => clearTimeout(t)
  }, [open, q])
  return (
    <Modal open={open} onClose={onClose} title="Adicionar tutorial à trilha">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input autoFocus className={cn(inputCls, 'pl-9')} value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar pelo título" />
      </div>
      <div className="max-h-[50vh] divide-y divide-neutral-200/70 overflow-y-auto dark:divide-neutral-800">
        {rows.filter(r => !exclude.has(r.id)).map(r => (
          <button key={r.id} onClick={async () => { await onPick(r.id); toast.success('Adicionado') }} className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-neutral-900/[.03]">
            <Plus className="size-4 text-accent-600" />
            <span className="min-w-0 flex-1"><span className="block truncate text-[15px] text-neutral-900 dark:text-white">{r.title}</span><span className="text-[12px] text-neutral-500">{r.category_name ?? 'Geral'}</span></span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

/** Lista de trilhas */
export function TrailsList() {
  const nav = useNavigate()
  const { profile, isModerator } = useAuth()
  const [rows, setRows] = useState<(Trail & { total: number; done: number })[] | null>(null)
  const [creating, setCreating] = useState(false)
  useEffect(() => {
    Promise.all([
      supabase.from('kb_trails').select('*, items:kb_trail_items(count)').order('created_at', { ascending: false }),
      supabase.from('kb_trail_progress').select('trail_id').eq('user_id', profile!.id),
    ]).then(([t, p]) => {
      const done = new Map<string, number>()
      p.data?.forEach(r => done.set(r.trail_id, (done.get(r.trail_id) ?? 0) + 1))
      setRows(((t.data ?? []) as (Trail & { items: { count: number }[] })[]).map(x => ({ ...x, total: x.items?.[0]?.count ?? 0, done: done.get(x.id) ?? 0 })))
    })
  }, [profile])

  return (
    <div className="space-y-5 fade-up">
      <div className="flex items-end justify-between gap-3 pt-1">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-neutral-900 dark:text-white">Trilhas</h1>
          <p className="text-[15px] text-neutral-500">Sequências de tutoriais para aprender passo a passo.</p>
        </div>
        {isModerator && <Button onClick={() => setCreating(true)}><Plus className="size-4" />Nova trilha</Button>}
      </div>
      {!rows ? <CardsSkeleton count={3} /> : rows.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Route className="size-12 text-neutral-300 dark:text-neutral-600" strokeWidth={1.4} />
          <p className="mt-3 text-[17px] font-semibold text-neutral-900 dark:text-white">Nenhuma trilha ainda</p>
          <p className="mt-1 max-w-sm text-[15px] text-neutral-500">{isModerator ? 'Crie a primeira, por exemplo “Onboarding de novo field”.' : 'Os administradores ainda não criaram trilhas.'}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(t => <TrailCard key={t.id} t={t} onClick={() => nav(`/trilhas/${t.id}`)} />)}
        </div>
      )}
      {creating && <TrailForm onClose={() => setCreating(false)} onSaved={id => nav(`/trilhas/${id}`)} />}
    </div>
  )
}

export function TrailCard({ t, onClick, compact }: { t: Trail & { total: number; done: number }; onClick: () => void; compact?: boolean }) {
  const pct = t.total ? Math.round((t.done / t.total) * 100) : 0
  return (
    <button onClick={onClick} className={cn('card press flex flex-col overflow-hidden text-left', compact && 'w-[260px] shrink-0')}>
      <div className="h-1.5 w-full" style={{ background: t.color }} />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[10px] text-white" style={{ background: t.color }}><Route className="size-5" /></span>
          <div className="min-w-0">
            <div className="text-[16px] font-semibold leading-snug text-neutral-900 line-clamp-2 dark:text-white">{t.title}</div>
            <div className="text-[12px] text-neutral-500">{t.total} tutoriais{t.status === 'draft' && ' · rascunho'}</div>
          </div>
        </div>
        {!compact && t.description && <p className="mt-2 text-[14px] text-neutral-500 line-clamp-2">{t.description}</p>}
        <div className="mt-auto pt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: t.color }} /></div>
          <div className="mt-1 text-[12px] text-neutral-500">{t.done === 0 ? 'Não iniciada' : pct === 100 ? 'Concluída ✓' : `${pct}% concluído`}</div>
        </div>
      </div>
    </button>
  )
}
