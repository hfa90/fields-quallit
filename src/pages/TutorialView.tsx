import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Share, Pencil, Trash2, Printer, ChevronLeft, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, ATTACHMENTS_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { cameFromSharedLink } from '../lib/entry'
import type { Attachment, Category, LinkItem, Profile, Tutorial, Viewer } from '../lib/types'
import { DIFFICULTY, cn, errMsg, fmtDate, fmtDateTime, readingTime, shortUrl, timeAgo } from '../lib/utils'
import TutorialContent, { type Heading } from '../components/TutorialContent'
import ShareDialog from '../components/ShareDialog'
import { AttachmentList, LinkList } from '../components/Attachments'
import { Avatar, Button, CategoryIcon, Modal, SectionTitle, Spinner } from '../components/ui'
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
  const [copied, setCopied] = useState(false)

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
    return () => { alive = false; document.title = 'Fields Quallit' }
  }, [code])

  if (t === undefined) return <Spinner />
  if (t === null) return <NotFound message="Tutorial não encontrado ou sem permissão de acesso" />

  const canEdit = isModerator || t.author_id === profile?.id
  const d = DIFFICULTY[t.difficulty]
  const color = t.category?.color ?? '#8e8e93'
  const url = shortUrl(t.short_code)
  const totalViews = viewers?.reduce((s, v) => s + Number(v.views), 0) ?? 0
  const hasText = !!t.content_html.replace(/<[^>]+>/g, '').trim() || t.content_html.includes('<img')

  const quickShare = async () => {
    if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      try { await navigator.share({ title: t.title, url }); return } catch { /* cancelado */ }
    }
    setShare(true)
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success('Link copiado'); setTimeout(() => setCopied(false), 1800) }
    catch { setShare(true) }
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
      {/* Barra de navegação */}
      <div className="no-print -mt-1 mb-4 flex items-center justify-between gap-2">
        <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} className="-ml-2 inline-flex h-9 items-center text-[17px] text-accent-600 dark:text-accent-400">
          <ChevronLeft className="size-6" strokeWidth={2.2} />Voltar
        </button>
        <div className="flex items-center gap-1">
          <IconBtn title="Imprimir / PDF" onClick={() => window.print()} className="hidden sm:grid"><Printer className="size-[18px]" /></IconBtn>
          {canEdit && <IconBtn title="Editar" onClick={() => nav(`/t/${t.short_code}/editar`)}><Pencil className="size-[18px]" /></IconBtn>}
          {canEdit && <IconBtn title="Excluir" onClick={() => setConfirmDel(true)} className="text-[#ff3b30]"><Trash2 className="size-[18px]" /></IconBtn>}
          <IconBtn title="Compartilhar" onClick={quickShare}><Share className="size-[18px]" /></IconBtn>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {/* Cabeçalho */}
          <header className="mx-auto max-w-[720px]">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium">
              <Link to={`/?c=${t.category_id ?? ''}`} className="inline-flex items-center gap-1.5" style={{ color }}>
                <CategoryIcon name={t.category?.icon} className="size-4" />{t.category?.name ?? 'Geral'}
              </Link>
              <span className="text-neutral-300 dark:text-neutral-700">·</span>
              <span className="text-neutral-500">{d.label}</span>
              {t.status === 'draft' && <><span className="text-neutral-300 dark:text-neutral-700">·</span><span className="text-[#ff9500]">Rascunho — visível só para você e moderadores</span></>}
            </div>
            <h1 className="mt-2 text-[28px] font-bold leading-[1.15] tracking-tight text-neutral-900 sm:text-[36px] dark:text-white">{t.title}</h1>
            {t.summary && <p className="mt-3 text-[17px] leading-relaxed text-neutral-500 sm:text-[19px]">{t.summary}</p>}
            <div className="mt-5 flex items-center gap-3">
              <Avatar name={t.author?.full_name} email={t.author?.email} url={t.author?.avatar_url} size={36} />
              <div className="min-w-0 text-[13px] leading-tight">
                <div className="truncate text-[15px] font-medium text-neutral-900 dark:text-neutral-100">{t.author?.full_name}</div>
                <div className="mt-0.5 text-neutral-500">{fmtDate(t.created_at)} · {readingTime(t.content_html)} min de leitura · {viewers?.length ?? '–'} {viewers?.length === 1 ? 'leitor' : 'leitores'}</div>
              </div>
            </div>
            {t.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {t.tags.map(tag => <Link key={tag} to={`/?q=${encodeURIComponent(tag)}`} className="rounded-md bg-neutral-900/[.05] px-2 py-0.5 text-[13px] text-neutral-600 hover:text-neutral-900 dark:bg-white/10 dark:text-neutral-400">{tag}</Link>)}
              </div>
            )}
          </header>

          <div className="mx-auto mt-6 max-w-[720px] border-t border-neutral-200 pt-7 dark:border-neutral-800">
            {hasText
              ? <TutorialContent html={t.content_html} onHeadings={setHeadings} />
              : <p className="text-neutral-400">Este tutorial não tem texto — veja os anexos e links.</p>}
          </div>
          <p className="no-print mx-auto mt-10 max-w-[720px] text-[13px] text-neutral-400">
            Atualizado {timeAgo(t.updated_at)}{t.editor?.full_name ? ` por ${t.editor.full_name}` : ''} · {fmtDateTime(t.updated_at)}
          </p>
        </div>

        {/* Lateral */}
        <aside className="no-print space-y-6 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:pb-4">
          <section>
            <SectionTitle>Link curto</SectionTitle>
            <div className="card flex items-center gap-2 p-1.5 pl-3.5">
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-neutral-700 dark:text-neutral-300">{url.replace(/^https?:\/\//, '')}</span>
              <Button size="sm" variant="tinted" onClick={copy}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? 'Copiado' : 'Copiar'}</Button>
            </div>
            <button onClick={() => setShare(true)} className="mt-2 px-1 text-[13px] font-medium text-accent-600 dark:text-accent-400">Mais opções de compartilhamento</button>
          </section>

          {headings.length > 1 && (
            <section className="hidden lg:block">
              <SectionTitle>Neste tutorial</SectionTitle>
              <nav className="border-l border-neutral-200 dark:border-neutral-800">
                {headings.map(h => (
                  <a key={h.id} href={`#${h.id}`}
                    onClick={e => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' }) }}
                    className={cn('-ml-px block truncate border-l border-transparent py-1 pl-3.5 text-[14px] text-neutral-500 hover:border-neutral-400 hover:text-neutral-900 dark:hover:text-white',
                      h.level === 3 && 'pl-6 text-[13px]')}>{h.text}</a>
                ))}
              </nav>
            </section>
          )}

          {files.length > 0 && <section><SectionTitle>Anexos · {files.length}</SectionTitle><AttachmentList items={files} /></section>}
          {links.length > 0 && <section><SectionTitle>Links úteis · {links.length}</SectionTitle><LinkList items={links} /></section>}

          <section>
            <SectionTitle>Visualizado por{viewers ? ` · ${viewers.length}` : ''}</SectionTitle>
            <div className="card overflow-hidden">
              {!viewers ? <div className="h-16 animate-pulse" /> : viewers.length === 0 ? (
                <p className="p-4 text-[14px] text-neutral-400">Ninguém ainda.</p>
              ) : (
                <>
                  <ul className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                    {viewers.slice(0, allViewers ? undefined : 8).map(v => (
                      <li key={v.user_id} className="flex items-center gap-3 px-3.5 py-2.5" title={`Primeira vez: ${fmtDateTime(v.first_viewed)}\nÚltima vez: ${fmtDateTime(v.last_viewed)}`}>
                        <Avatar name={v.full_name} email={v.email} url={v.avatar_url} size={30} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-medium text-neutral-900 dark:text-neutral-100">
                            {v.full_name || v.email}{v.user_id === profile?.id && <span className="font-normal text-neutral-400"> (você)</span>}
                          </div>
                          <div className="text-[12px] text-neutral-500">{timeAgo(v.last_viewed)}{Number(v.views) > 1 && ` · ${v.views} vezes`}{v.via_share && ' · via link'}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {viewers.length > 8 && (
                    <button onClick={() => setAllViewers(a => !a)} className="w-full border-t border-neutral-200/70 py-2.5 text-[14px] font-medium text-accent-600 dark:border-neutral-800 dark:text-accent-400">
                      {allViewers ? 'Mostrar menos' : `Ver todos (${viewers.length})`}
                    </button>
                  )}
                </>
              )}
            </div>
            {viewers && viewers.length > 0 && <p className="mt-2 px-1 text-[12px] text-neutral-400">{totalViews} visualizações no total</p>}
          </section>
        </aside>
      </div>

      <ShareDialog open={share} onClose={() => setShare(false)} url={url} title={t.title} />
      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="Excluir tutorial?">
        <p className="text-[15px] text-neutral-600 dark:text-neutral-400">“{t.title}” será excluído permanentemente, junto com anexos, links e histórico de visualizações. Não é possível desfazer.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setConfirmDel(false)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={remove}>Excluir</Button>
        </div>
      </Modal>
    </article>
  )
}

function IconBtn({ children, title, onClick, className }: { children: React.ReactNode; title: string; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      className={cn('press grid size-9 place-items-center rounded-full text-accent-600 hover:bg-neutral-900/5 dark:text-accent-400 dark:hover:bg-white/10', className)}>
      {children}
    </button>
  )
}
