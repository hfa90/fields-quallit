import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, PenLine, Link2, Trash2, CheckCircle2, FileText, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { RequestItem } from '../lib/types'
import { errMsg } from '../lib/utils'
import { Button, Modal, Spinner, inputCls } from '../components/ui'
import Comments from '../components/Comments'
import { REQ_SELECT, RequestCard } from './Community'
import NotFound from './NotFound'

export default function RequestPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { profile, isModerator } = useAuth()
  const [r, setR] = useState<RequestItem | null | undefined>(undefined)
  const [linkOpen, setLinkOpen] = useState(false)
  const [mine, setMine] = useState<{ id: string; title: string }[]>([])
  const [pick, setPick] = useState('')

  const load = () => supabase.from('kb_requests').select(REQ_SELECT).eq('id', id).maybeSingle().then(({ data }) => setR((data as RequestItem) ?? null))
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (r === undefined) return <Spinner />
  if (r === null) return <NotFound message="Pedido não encontrado" />
  const owner = r.user_id === profile?.id || isModerator

  const vote = async () => {
    const voted = r.votes?.some(v => v.user_id === profile?.id)
    const { error } = voted
      ? await supabase.from('kb_request_votes').delete().eq('request_id', r.id).eq('user_id', profile!.id)
      : await supabase.from('kb_request_votes').insert({ request_id: r.id })
    if (error) toast.error(errMsg(error)); else load()
  }
  const openLink = async () => {
    const { data } = await supabase.from('kb_tutorials').select('id,title').eq('author_id', profile!.id).eq('status', 'published').order('created_at', { ascending: false })
    setMine(data ?? []); setPick(data?.[0]?.id ?? ''); setLinkOpen(true)
  }
  const linkTutorial = async () => {
    const { error } = await supabase.rpc('kb_answer_request', { p_request: r.id, p_tutorial: pick })
    if (error) return toast.error(errMsg(error))
    toast.success('Pedido atendido! Quem pediu foi avisado.'); setLinkOpen(false); load()
  }
  const setStatus = async (status: 'closed' | 'open') => {
    const { error } = await supabase.from('kb_requests').update({ status }).eq('id', r.id)
    if (error) toast.error(errMsg(error)); else load()
  }
  const remove = async () => {
    if (!confirm('Excluir este pedido?')) return
    const { error } = await supabase.from('kb_requests').delete().eq('id', r.id)
    if (error) return toast.error(errMsg(error))
    nav('/comunidade', { replace: true })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 fade-up">
      <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/comunidade'))} className="-ml-2 inline-flex h-9 items-center text-[17px] text-accent-600 dark:text-accent-400">
        <ChevronLeft className="size-6" strokeWidth={2.2} />Comunidade
      </button>
      <RequestCard r={r} me={profile?.id} onVote={vote} />

      {r.status === 'answered' && r.tutorial ? (
        <Link to={`/t/${r.tutorial.short_code}`} className="card flex items-center gap-3 p-4 ring-1 ring-[#34c759]/40">
          <CheckCircle2 className="size-6 shrink-0 text-[#34c759]" />
          <span className="min-w-0 flex-1"><span className="block text-[13px] text-neutral-500">Atendido com o tutorial</span><span className="block truncate text-[16px] font-semibold text-neutral-900 dark:text-white">{r.tutorial.title}</span></span>
          <FileText className="size-5 text-neutral-400" />
        </Link>
      ) : r.status === 'open' ? (
        <div className="card space-y-3 p-4">
          <div className="text-[15px] font-semibold text-neutral-900 dark:text-white">Você sabe resolver isso?</div>
          <p className="text-[14px] text-neutral-500">Escreva um tutorial: ele fica vinculado a este pedido e quem pediu é avisado. Vale +15 pontos.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => nav(`/novo?pedido=${r.id}`)}><PenLine className="size-4" />Escrever tutorial</Button>
            <Button variant="tinted" onClick={openLink}><Link2 className="size-4" />Vincular tutorial existente</Button>
          </div>
        </div>
      ) : (
        <p className="px-1 text-[14px] text-neutral-500">Pedido encerrado.</p>
      )}

      {owner && (
        <div className="flex flex-wrap gap-2">
          {r.status === 'open' && <Button size="sm" variant="secondary" onClick={() => setStatus('closed')}><XCircle className="size-4" />Encerrar pedido</Button>}
          {r.status === 'closed' && <Button size="sm" variant="secondary" onClick={() => setStatus('open')}>Reabrir</Button>}
          <Button size="sm" variant="ghost" className="text-[#ff3b30]" onClick={remove}><Trash2 className="size-4" />Excluir</Button>
        </div>
      )}

      <Comments requestId={r.id} ownerId={r.user_id} kinds={['comment', 'tip', 'question']} title="Respostas e dicas" />

      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Vincular tutorial">
        {mine.length === 0 ? <p className="text-[15px] text-neutral-500">Você ainda não tem tutoriais publicados.</p> : (
          <div className="space-y-4">
            <select className={inputCls} value={pick} onChange={e => setPick(e.target.value)}>{mine.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
            <Button className="w-full" onClick={linkTutorial}>Vincular e marcar como atendido</Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
