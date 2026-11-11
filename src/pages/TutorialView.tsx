import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Share2, Pencil, Trash2, Printer, Clock, CalendarDays, Eye, Paperclip, Link2, ListTree, Users, ArrowLeft, FileEdit, Share,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase, ATTACHMENTS_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { cameFromSharedLink } from '../lib/entry'
import type { Attachment, Category, LinkItem, Profile, Tutorial, Viewer } from '../lib/types'
import { DIFFICULTY, cn, errMsg, fmtDate, fmtDateTime, readingTime, shortUrl, timeAgo } from '../lib/utils'
import TutorialContent, { type Heading } from '../components/TutorialContent'
import ShareDialog from '../components/ShareDialog'
import { AttachmentList, LinkList } from '../components/Attachments'
import { Avatar, Button, CategoryIcon, Modal, Spinner } from '../components/ui'
import NotFound from './NotFound'

type Full = Tutorial & {
  author: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'> | null
  editor: Pick<Profile, 'full_name'> | null
  category: Category | null
}

export default function TutorialView() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const { profile, isModerator } = useAuth()
  const [t, setT] = useState<Full | null | undefined>(undefined)
  const [links, setLinks] = useState<LinkItem[]>([])
  const [files, setFiles] = useState<Attachment[]>([])
  const [viewers, setViewers] = useState<Viewer[] | null>(null)
  const [headings, setHeadings] = useState<Heading[]>([])
  const [share, setShare] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [allViewers, setAllViewers] = useState(false)

  useEffect(() => {
    let alive = true
    setT(undefined)
    ;(async () => {
      const { data, error } = await supabase.from('kb_tutorials')
        .select('*, author:kb_profiles!kb_tutorials_author_id_fkey(id,full_name,email,avatar_url), editor:kb_profiles!kb_tutorials_updated_by_fkey(full_name), category:kb_categories(*)')
        .eq('short_code', code).maybeSingle()
      if (!alive) return
      if (error) console.error(error)
      setT((data as Full) ?? null)
      if (!data) return
      document.title = `${data.title} · Fields Quallit`
      const [l, a] = await Promise.all([
        supabase.from('kb_links').select('*').eq('tutorial_id', data.id).order('sort_order'),
        supabase.from('kb_attachments').select('*').eq('tutorial_id', data.id).order('created_at'),
      ])
      if (!alive) return
      setLinks(l.data ?? []); setFiles(a.data ?? [])
      await supabase.rpc('kb_register_view', { p_tutorial: data.id, p_via_share: cameFromSharedLink(code) })
      const v = await supabase.rpc('kb_tutorial_viewers', { p_tutorial: data.id })
      if (alive) setViewers((v.data as Viewer[]) ?? [])
    })()
    return () => { alive = false; document.title = 'Fields Quallit · Central de Tutoriais' }
  }, [code])

  if (t === undefined) return <Spinner label="Abrindo tutorial…" />
  if (t === null) return <NotFound message="Tutorial não encontrado ou sem permissão de acesso" />

  const canEdit = isModerator || t.author_id === profile?.id
  const d = DIFFICULTY[t.difficulty]
  const color = t.category?.color ?? '#64748b'
  const url = shortUrl(t.short_code)
  const totalViews = viewers?.reduce((s, v) => s + Number(v.views), 0) ?? 0

  const quickShare = async () => {
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      try { await navigator.share({ title: t.title, url }); return } catch { /* cancelado */ }
    }
    setShare(true)
  }

  const remove = async () => {
    setDeleting(true)
    try {
      if (files.length) await supabase.storage.from(ATTACHMENTS_BUCKET).remove(files.map(f => f.storage_path))
      const { error } = await supabase.from('kb_tutorials').delete().eq('id', t.id)
      if (error) throw error
      toast.success('Tutorial excluído')
      nav('/', { replace: true })
    } catch (e) { toast.error(errMsg(e)); setDeleting(false) }
  }

  return (
    <article className="fade-up">
      <div className="no-print mb-5 flex items-center justify-between gap-3">
        <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 hover:bg-white hover:text-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-200">
          <ArrowLeft className="size-4" />Voltar
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} title="Imprimir ou salvar como PDF"><Printer className="size-4" /><span className="hidden sm:inline">Imprimir</span></Button>
          {canEdit && <Button variant="outline" size="sm" onClick={() => nav(`/t/${t.short_code}/editar`)}><Pencil className="size-4" /><span className="hidden sm:inline">Editar</span></Button>}
          {canEdit && <Button variant="outline" size="sm" onClick={() => setConfirmDel(true)} className="text-rose-600"><Trash2 className="size-4" /></Button>}
          <Button size="sm" onClick={quickShare}><Share2 className="size-4" />Compartilhar</Button>
        </div>
      </div>

      {/* Cabeçalho */}
      <header className="relative overflow-hidden rounded-3xl bg-white p-6 ring-1 ring-slate-200 sm:p-10 dark:bg-slate-900 dark:ring-slate-800">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${color}, ${color}55)` }} />
        <div className="absolute -right-16 -top-16 size-56 rounded-full opacity-[0.08] blur-2xl" style={{ background: color }} />
        <div className="relative flex flex-wrap items-center gap-2">
          <Link to={`/?c=${t.category_id ?? ''}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold" style={{ color, background: `${color}14` }}>
            <CategoryIcon name={t.category?.icon} className="size-4" />{t.category?.name ?? 'Sem categoria'}
          </Link>
          <span className={cn('rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-medium dark:bg-slate-800', d.style)}>{'●'.repeat(d.dots)}<span className="opacity-30">{'●'.repeat(3 - d.dots)}</span> {d.label}</span>
          {t.status === 'draft' && <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-sm font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><FileEdit className="size-3.5" />Rascunho — só você e moderadores veem</span>}
        </div>
        <h1 className="relative mt-4 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl dark:text-white">{t.title}</h1>
        {t.summary && <p className="relative mt-3 max-w-3xl text-lg text-slate-600 dark:text-slate-400">{t.summary}</p>}
        <div className="relative mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
          <div className="flex items-center gap-2.5">
            <Avatar name={t.author?.full_name} email={t.author?.email} url={t.author?.avatar_url} size={36} />
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">{t.author?.full_name}</div>
              <div className="text-xs">Autor</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{fmtDate(t.created_at)}</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="size-4" />{readingTime(t.content_html)} min de leitura</span>
          <span className="inline-flex items-center gap-1.5"><Eye className="size-4" />{viewers?.length ?? '–'} pessoas · {totalViews} visualizações</span>
        </div>
        {t.tags.length > 0 && (
          <div className="relative mt-5 flex flex-wrap gap-1.5">
            {t.tags.map(tag => <Link key={tag} to={`/?q=${encodeURIComponent(tag)}`} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-800 dark:text-slate-400">#{tag}</Link>)}
          </div>
        )}
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Conteúdo */}
        <div className="min-w-0 space-y-6">
          <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 sm:p-10 dark:bg-slate-900 dark:ring-slate-800">
            {t.content_html.replace(/<[^>]+>/g, '').trim() || t.content_html.includes('<img')
              ? <TutorialContent html={t.content_html} onHeadings={setHeadings} />
              : <p className="text-slate-400 italic">Este tutorial ainda não tem conteúdo escrito — veja os anexos e links.</p>}
          </div>
          <p className="no-print text-center text-xs text-slate-400">
            Última atualização {timeAgo(t.updated_at)}{t.editor?.full_name ? ` por ${t.editor.full_name}` : ''} · {fmtDateTime(t.updated_at)}
          </p>
        </div>

        {/* Lateral */}
        <aside className="no-print space-y-5 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pb-4">
          <button onClick={() => setShare(true)} className="group flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 p-4 text-left text-white shadow-lg shadow-indigo-500/20 transition hover:shadow-xl">
            <span className="grid size-10 place-items-center rounded-xl bg-white/20"><Share className="size-5" /></span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Compartilhar link curto</div>
              <div className="truncate font-mono text-xs text-indigo-100">{url.replace(/^https?:\/\//, '')}</div>
            </div>
          </button>

          {headings.length > 1 && (
            <Panel icon={<ListTree className="size-4" />} title="Neste tutorial">
              <nav className="space-y-0.5">
                {headings.map(h => (
                  <a key={h.id} href={`#${h.id}`}
                    onClick={e => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' }) }}
                    className={cn('block truncate rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800',
                      h.level === 3 && 'pl-6 text-[13px]', h.level === 1 && 'font-semibold')}>{h.text}</a>
                ))}
              </nav>
            </Panel>
          )}

          {files.length > 0 && <Panel icon={<Paperclip className="size-4" />} title={`Anexos (${files.length})`}><AttachmentList items={files} /></Panel>}
          {links.length > 0 && <Panel icon={<Link2 className="size-4" />} title={`Links úteis (${links.length})`}><LinkList items={links} /></Panel>}

          <Panel icon={<Users className="size-4" />} title={`Visualizado por${viewers ? ` (${viewers.length})` : ''}`}>
            {!viewers ? <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" /> : viewers.length === 0 ? (
              <p className="text-sm text-slate-400">Ninguém ainda.</p>
            ) : (
              <>
                <ul className="space-y-1">
                  {viewers.slice(0, allViewers ? undefined : 8).map(v => (
                    <li key={v.user_id} className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5" title={`Primeira vez: ${fmtDateTime(v.first_viewed)}\nÚltima vez: ${fmtDateTime(v.last_viewed)}`}>
                      <Avatar name={v.full_name} email={v.email} url={v.avatar_url} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                          {v.full_name || v.email}{v.user_id === profile?.id && <span className="ml-1 text-xs font-normal text-slate-400">(você)</span>}
                        </div>
                        <div className="text-xs text-slate-400">{timeAgo(v.last_viewed)}{Number(v.views) > 1 && ` · ${v.views}×`}{v.via_share && ' · via link'}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                {viewers.length > 8 && (
                  <button onClick={() => setAllViewers(a => !a)} className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10">
                    {allViewers ? 'Mostrar menos' : `Ver todos (${viewers.length})`}
                  </button>
                )}
              </>
            )}
          </Panel>
        </aside>
      </div>

      <ShareDialog open={share} onClose={() => setShare(false)} url={url} title={t.title} />
      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="Excluir tutorial?">
        <p className="text-sm text-slate-600 dark:text-slate-400">“{t.title}” será excluído permanentemente, junto com anexos, links e histórico de visualizações. Essa ação não pode ser desfeita.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDel(false)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={remove}><Trash2 className="size-4" />Excluir</Button>
        </div>
      </Modal>
    </article>
  )
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">{icon}{title}</h2>
      {children}
    </section>
  )
}
