import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, AlertTriangle, Lightbulb, HelpCircle, CheckCircle2, Reply, Trash2, ThumbsUp, ThumbsDown, Send } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Comment, CommentKind } from '../lib/types'
import { cn, errMsg, timeAgo } from '../lib/utils'
import { Avatar, Button, textareaCls } from './ui'

export const KINDS: Record<CommentKind, { label: string; icon: typeof MessageSquare; color: string; placeholder: string }> = {
  comment: { label: 'Comentário', icon: MessageSquare, color: '#8e8e93', placeholder: 'Escreva um comentário…' },
  outdated: { label: 'Passo desatualizado', icon: AlertTriangle, color: '#fe811e', placeholder: 'Qual passo mudou? Ex.: "Na versão 7.2 o menu Configurações virou Preferências"' },
  tip: { label: 'Dica', icon: Lightbulb, color: '#34c759', placeholder: 'Compartilhe um atalho, alternativa ou cuidado extra…' },
  question: { label: 'Pergunta', icon: HelpCircle, color: '#af52de', placeholder: 'Qual é a sua dúvida?' },
}

interface Props {
  tutorialId?: string
  requestId?: string
  ownerId: string
  /** tipos disponíveis no formulário */
  kinds?: CommentKind[]
  onCount?: (n: number) => void
  title?: string
  /** pede para abrir o formulário já em um tipo (ex.: depois de "Não funcionou") */
  prompt?: { kind: CommentKind; n: number }
}

export default function Comments({ tutorialId, requestId, ownerId, kinds = ['comment', 'outdated', 'tip', 'question'], onCount, title = 'Comentários', prompt }: Props) {
  const { profile, isModerator } = useAuth()
  const [items, setItems] = useState<Comment[] | null>(null)
  const [kind, setKind] = useState<CommentKind>(kinds[0])
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    let q = supabase.from('kb_comments').select('*, author:kb_profiles!kb_comments_user_id_fkey(full_name,email,avatar_url)').order('created_at')
    q = tutorialId ? q.eq('tutorial_id', tutorialId) : q.eq('request_id', requestId!)
    const { data } = await q
    setItems((data as Comment[]) ?? [])
  }
  useEffect(() => { load() }, [tutorialId, requestId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (items) onCount?.(items.length) }, [items, onCount])

  useEffect(() => {
    if (!prompt) return
    setReplyTo(null); setKind(prompt.kind)
    document.getElementById('comentarios')?.scrollIntoView({ behavior: 'smooth' })
    setTimeout(() => document.querySelector<HTMLTextAreaElement>('#comentarios textarea')?.focus(), 400)
  }, [prompt])

  const roots = useMemo(() => (items ?? []).filter(c => !c.parent_id), [items])
  const replies = (id: string) => (items ?? []).filter(c => c.parent_id === id)
  const canResolve = isModerator || profile?.id === ownerId

  const send = async () => {
    const text = body.trim()
    if (!text) return
    setBusy(true)
    const { error } = await supabase.from('kb_comments').insert({
      tutorial_id: tutorialId ?? null, request_id: requestId ?? null, parent_id: replyTo?.id ?? null,
      kind: replyTo ? 'comment' : kind, body: text,
    })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    setBody(''); setReplyTo(null); setKind(kinds[0])
    toast.success(kind === 'outdated' && !replyTo ? 'Obrigado! O autor foi avisado.' : 'Publicado')
    load()
  }
  const resolve = async (c: Comment) => {
    const { error } = await supabase.from('kb_comments').update({ resolved: !c.resolved, resolved_by: profile!.id }).eq('id', c.id)
    if (error) return toast.error(errMsg(error))
    load()
  }
  const remove = async (c: Comment) => {
    if (!confirm('Excluir este comentário?')) return
    const { error } = await supabase.from('kb_comments').delete().eq('id', c.id)
    if (error) return toast.error(errMsg(error))
    load()
  }

  const K = KINDS[replyTo ? 'comment' : kind]
  return (
    <section id="comentarios" className="scroll-mt-24">
      <h2 className="mb-3 text-[20px] font-bold tracking-tight text-neutral-900 dark:text-white">{title}{items && items.length > 0 && <span className="ml-1.5 text-neutral-400">{items.length}</span>}</h2>

      {/* Formulário */}
      <div className="card p-3">
        {replyTo ? (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-neutral-100 px-3 py-1.5 text-[13px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            <span className="truncate">Respondendo a <b>{replyTo.author?.full_name}</b></span>
            <button onClick={() => setReplyTo(null)} className="ml-2 font-medium text-accent-600">Cancelar</button>
          </div>
        ) : kinds.length > 1 && (
          <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
            {kinds.map(k => {
              const M = KINDS[k]
              return (
                <button key={k} onClick={() => setKind(k)}
                  className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition',
                    kind === k ? 'text-white' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300')}
                  style={kind === k ? { background: M.color } : undefined}>
                  <M.icon className="size-3.5" />{M.label}
                </button>
              )
            })}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Avatar name={profile?.full_name} email={profile?.email} url={profile?.avatar_url} size={32} />
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={body.split('\n').length > 2 ? 4 : 2} maxLength={5000}
            placeholder={K.placeholder}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }}
            className={cn(textareaCls, 'min-h-[44px] flex-1 resize-none bg-neutral-50 shadow-none dark:bg-neutral-800')} />
          <Button onClick={send} loading={busy} disabled={!body.trim()} className="size-11 shrink-0 rounded-full p-0" aria-label="Enviar"><Send className="size-4" /></Button>
        </div>
      </div>

      {/* Lista */}
      <div className="mt-4 space-y-3">
        {items === null ? <div className="card h-20 animate-pulse" /> : roots.length === 0 ? (
          <p className="px-1 text-[14px] text-neutral-500">Seja o primeiro a comentar. Reporte se algum passo mudou — isso mantém a biblioteca confiável.</p>
        ) : roots.map(c => (
          <div key={c.id} className={cn('card p-4', c.kind === 'outdated' && !c.resolved && 'ring-1 ring-brand-orange/50')}>
            <CommentItem c={c} canResolve={canResolve} me={profile?.id} isMod={isModerator}
              onReply={() => { setReplyTo(c); document.querySelector<HTMLTextAreaElement>('#comentarios textarea')?.focus() }}
              onResolve={() => resolve(c)} onDelete={() => remove(c)} />
            {replies(c.id).length > 0 && (
              <div className="mt-3 space-y-3 border-l-2 border-neutral-200 pl-4 dark:border-neutral-800">
                {replies(c.id).map(r => <CommentItem key={r.id} c={r} me={profile?.id} isMod={isModerator} onDelete={() => remove(r)} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function CommentItem({ c, me, isMod, canResolve, onReply, onResolve, onDelete }: {
  c: Comment; me?: string; isMod: boolean; canResolve?: boolean; onReply?: () => void; onResolve?: () => void; onDelete: () => void
}) {
  const M = KINDS[c.kind]
  return (
    <div className="flex gap-3">
      <Link to={`/pessoa/${c.user_id}`}><Avatar name={c.author?.full_name} email={c.author?.email} url={c.author?.avatar_url} size={32} /></Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
          <Link to={`/pessoa/${c.user_id}`} className="font-semibold text-neutral-900 hover:underline dark:text-white">{c.author?.full_name ?? 'Usuário'}</Link>
          {c.kind !== 'comment' && (
            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-px text-[11px] font-semibold" style={{ color: M.color, background: `${M.color}1a` }}>
              <M.icon className="size-3" />{M.label}
            </span>
          )}
          {c.resolved && <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#248a3d] dark:text-[#30d158]"><CheckCircle2 className="size-3.5" />Resolvido</span>}
          <span className="text-neutral-400">{timeAgo(c.created_at)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300">{c.body}</p>
        <div className="mt-1.5 flex gap-4 text-[13px] font-medium text-neutral-500">
          {onReply && <button onClick={onReply} className="inline-flex items-center gap-1 hover:text-neutral-800 dark:hover:text-white"><Reply className="size-3.5" />Responder</button>}
          {onResolve && canResolve && c.kind !== 'comment' && (
            <button onClick={onResolve} className="inline-flex items-center gap-1 hover:text-neutral-800 dark:hover:text-white"><CheckCircle2 className="size-3.5" />{c.resolved ? 'Reabrir' : 'Marcar como resolvido'}</button>
          )}
          {(c.user_id === me || isMod) && <button onClick={onDelete} className="inline-flex items-center gap-1 hover:text-[#ff3b30]"><Trash2 className="size-3.5" />Excluir</button>}
        </div>
      </div>
    </div>
  )
}

/** "Funcionou para você?" */
export function Feedback({ tutorialId, onNotHelpful }: { tutorialId: string; onNotHelpful: () => void }) {
  const { profile } = useAuth()
  const [mine, setMine] = useState<boolean | null>(null)
  const [counts, setCounts] = useState({ yes: 0, no: 0 })

  const load = async () => {
    const { data } = await supabase.from('kb_feedback').select('user_id, helpful').eq('tutorial_id', tutorialId)
    const rows = data ?? []
    setCounts({ yes: rows.filter(r => r.helpful).length, no: rows.filter(r => !r.helpful).length })
    setMine(rows.find(r => r.user_id === profile?.id)?.helpful ?? null)
  }
  useEffect(() => { load() }, [tutorialId]) // eslint-disable-line react-hooks/exhaustive-deps

  const vote = async (helpful: boolean) => {
    if (mine === helpful) {
      setMine(null)
      await supabase.from('kb_feedback').delete().eq('tutorial_id', tutorialId).eq('user_id', profile!.id)
    } else {
      setMine(helpful)
      const { error } = await supabase.from('kb_feedback').upsert({ tutorial_id: tutorialId, user_id: profile!.id, helpful })
      if (error) { toast.error(errMsg(error)); return }
      if (helpful) toast.success('Valeu! Isso ajuda a comunidade a encontrar os melhores tutoriais.')
      else onNotHelpful()
    }
    load()
  }

  return (
    <div className="card flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
      <div>
        <div className="text-[17px] font-semibold text-neutral-900 dark:text-white">Funcionou para você?</div>
        <div className="text-[13px] text-neutral-500">
          {counts.yes + counts.no === 0 ? 'Sua resposta ajuda a manter a biblioteca confiável.' : `${counts.yes} ${counts.yes === 1 ? 'pessoa disse' : 'pessoas disseram'} que funcionou${counts.no ? ` · ${counts.no} que não` : ''}`}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => vote(true)}
          className={cn('press inline-flex h-11 items-center gap-2 rounded-full px-5 text-[15px] font-medium transition',
            mine === true ? 'bg-[#34c759] text-white' : 'bg-[#34c759]/10 text-[#248a3d] dark:text-[#30d158]')}>
          <ThumbsUp className="size-[18px]" fill={mine === true ? 'currentColor' : 'none'} />Funcionou
        </button>
        <button onClick={() => vote(false)}
          className={cn('press inline-flex h-11 items-center gap-2 rounded-full px-5 text-[15px] font-medium transition',
            mine === false ? 'bg-[#ff3b30] text-white' : 'bg-[#ff3b30]/10 text-[#d70015] dark:text-[#ff453a]')}>
          <ThumbsDown className="size-[18px]" fill={mine === false ? 'currentColor' : 'none'} />Não funcionou
        </button>
      </div>
    </div>
  )
}
