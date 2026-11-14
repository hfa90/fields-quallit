import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Share, Pencil, Trash2, Printer, ChevronLeft, Copy, Check, Bookmark, AlertTriangle, UserPlus, UserCheck, History, CloudDownload, CloudCheck, Loader2, WifiOff, CalendarCheck, Route, ChevronRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, ATTACHMENTS_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { cameFromSharedLink } from '../lib/entry'
import type { Attachment, Category, LinkItem, Profile, Tutorial, Viewer } from '../lib/types'
import { DIFFICULTY, cn, errMsg, fmtDate, fmtDateTime, readingTime, shortUrl, timeAgo } from '../lib/utils'
import TutorialContent, { type Heading } from '../components/TutorialContent'
import ShareDialog from '../components/ShareDialog'
import { AttachmentList, LinkList } from '../components/Attachments'
import { Avatar, Button, CategoryIcon, Modal, SectionTitle, Spinner, VerifiedBadge } from '../components/ui'
import Comments, { Feedback } from '../components/Comments'
import { useFavorites, useFollows } from '../lib/library'
import type { CommentKind } from '../lib/types'
import NotFound from './NotFound'
import { isNative, nativeShare } from '../lib/native'
import { ThanksBox } from '../components/Engagement'
import { FULL_SELECT, getOfflineByCode, isNetworkError, removeOffline, saveOffline, useOfflineIds, type OfflineBundle } from '../lib/offline'
import { useTrailNav } from './TrailPage'
// histórico de versões (com o comparador de textos) só é baixado quando alguém abre
const VersionHistory = lazy(() => import('../components/VersionHistory'))

type Full = Tutorial & {
  author: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'> | null
  editor: Pick<Profile, 'full_name'> | null
  verifier?: Pick<Profile, 'full_name'> | null
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
  const [outdated, setOutdated] = useState(0)
  const [prompt, setPrompt] = useState<{ kind: CommentKind; n: number }>()
  const { favs, toggle: toggleFav } = useFavorites()
  const follows = useFollows()
  const loc = useLocation()
  const [history, setHistory] = useState(false)
  const [offlineCopy, setOfflineCopy] = useState<OfflineBundle | null>(null)
  const [savingOffline, setSavingOffline] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [verifying, setVerifying] = useState(false)
  const [authorCd, setAuthorCd] = useState<string | null>(null)
  const [contributors, setContributors] = useState<{ user_id: string; full_name: string | null; avatar_url: string | null; cd_name: string | null; edits: number; last_at: string }[]>([])
  const offlineIds = useOfflineIds()
  const trail = useTrailNav(t?.id)

  useEffect(() => {
    let alive = true
    setT(undefined); setOfflineCopy(null)
    ;(async () => {
      const loadOfflineCopy = async () => {
        const b = await getOfflineByCode(code)
        if (!alive) return true
        if (b) { setOfflineCopy(b); setT(b.tutorial); setLinks(b.links); setFiles(b.files); setViewers([]); document.title = `${b.title} · Fields`; return true }
        return false
      }
      if (!navigator.onLine && await loadOfflineCopy()) return
      const { data, error } = await supabase.from('kb_tutorials').select(FULL_SELECT).eq('short_code', code).maybeSingle()
      if (!alive) return
      if (error) {
        console.error(error)
        if (isNetworkError(error) && await loadOfflineCopy()) return
      }
      setT((data as Full) ?? null)
      if (!data) return
      document.title = `${data.title} · Fields Quallit`
      const [l, a] = await Promise.all([
        supabase.from('kb_links').select('*').eq('tutorial_id', data.id).order('sort_order'),
        supabase.from('kb_attachments').select('*').eq('tutorial_id', data.id).order('created_at'),
      ])
      if (!alive) return
      setLinks(l.data ?? []); setFiles(a.data ?? [])
      supabase.rpc('kb_cd_of', { p_user: data.author_id }).then(({ data: cd }) => { if (alive) setAuthorCd((cd as string) ?? null) })
      supabase.rpc('kb_contributors', { p_tutorial: data.id }).then(({ data: cs }) => { if (alive) setContributors((cs as typeof contributors) ?? []) })
      supabase.from('kb_comments').select('id', { count: 'exact', head: true }).eq('tutorial_id', data.id).eq('kind', 'outdated').eq('resolved', false)
        .then(({ count }) => { if (alive) setOutdated(count ?? 0) })
      await supabase.rpc('kb_register_view', { p_tutorial: data.id, p_via_share: cameFromSharedLink(code) })
      const v = await supabase.rpc('kb_tutorial_viewers', { p_tutorial: data.id })
      if (alive) setViewers((v.data as Viewer[]) ?? [])
    })()
    return () => { alive = false; document.title = 'Fields Quallit' }
  }, [code, reload])

  // Abre direto nos comentários quando vem de uma notificação
  const wantsComments = loc.hash === '#comentarios' || (loc.state as { hash?: string } | null)?.hash === 'comentarios'
  useEffect(() => {
    if (t && wantsComments) setTimeout(() => document.getElementById('comentarios')?.scrollIntoView({ behavior: 'smooth' }), 400)
  }, [t, wantsComments])

  if (t === undefined) return <Spinner />
  if (t === null) return <NotFound message="Tutorial não encontrado ou sem permissão de acesso" />

  const canEdit = isModerator || t.author_id === profile?.id
  // qualquer Field pode melhorar uma publicação publicada (fica registrado com o nome dele)
  const canImprove = canEdit || t.status === 'published'
  const improvedByOther = !!t.updated_by && t.updated_by !== t.author_id && !!t.editor?.full_name
  const d = DIFFICULTY[t.difficulty]
  const color = t.category?.color ?? '#8e8e93'
  const url = shortUrl(t.short_code)
  const totalViews = viewers?.reduce((s, v) => s + Number(v.views), 0) ?? 0
  const hasText = !!t.content_html.replace(/<[^>]+>/g, '').trim() || t.content_html.includes('<img')

  const quickShare = async () => {
    if (isNative) { try { await nativeShare(t.title, url); return } catch { /* cancelado */ } }
    if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      try { await navigator.share({ title: t.title, url }); return } catch { /* cancelado */ }
    }
    setShare(true)
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success('Link copiado'); setTimeout(() => setCopied(false), 1800) }
    catch { setShare(true) }
  }

  const isOffline = offlineIds.has(t.id)
  const toggleOffline = async () => {
    if (isOffline) {
      await removeOffline(t.id); toast('Removido do modo offline')
      return
    }
    setSavingOffline('Preparando…')
    try {
      const b = await saveOffline(t.short_code, setSavingOffline)
      toast.success('Disponível offline', { description: `Você pode abrir este tutorial sem internet (${Math.max(1, Math.round(b.bytes / 1048576))} MB).` })
    } catch (e) { toast.error(errMsg(e)) } finally { setSavingOffline(null) }
  }
  const toggleVerified = async () => {
    setVerifying(true)
    const on = !t.verified_at
    const { error } = await supabase.rpc('kb_set_verified', { p_tutorial: t.id, p_verified: on })
    setVerifying(false)
    if (error) return toast.error(errMsg(error))
    toast.success(on ? 'Tutorial verificado — ele agora aparece primeiro na busca e na biblioteca' : 'Verificação removida')
    setReload(r => r + 1)
  }
  const markReviewed = async () => {
    const { error } = await supabase.rpc('kb_mark_reviewed', { p_tutorial: t.id, p_resolve_outdated: true })
    if (error) return toast.error(errMsg(error))
    toast.success('Tutorial marcado como revisado')
    setReload(r => r + 1)
  }
  const reviewDue = !!t.reviewed_at && new Date(t.reviewed_at).getTime() + (t.review_interval_months ?? 6) * 30.44 * 864e5 < Date.now()

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
          <IconBtn title={isOffline ? 'Disponível offline (toque para remover)' : 'Salvar para usar sem internet'} onClick={toggleOffline}
            className={isOffline ? 'text-[#34c759] dark:text-[#30d158]' : ''}>
            {savingOffline ? <Loader2 className="size-[18px] animate-spin" /> : isOffline ? <CloudCheck className="size-[18px]" /> : <CloudDownload className="size-[18px]" />}
          </IconBtn>
          {!offlineCopy && <IconBtn title="Histórico de versões" onClick={() => setHistory(true)}><History className="size-[18px]" /></IconBtn>}
          <IconBtn title={favs.has(t.id) ? 'Remover dos favoritos' : 'Favoritar'} onClick={() => toggleFav(t.id)} className={favs.has(t.id) ? 'text-brand-orange dark:text-brand-orange' : ''}>
            <Bookmark className="size-[18px]" fill={favs.has(t.id) ? 'currentColor' : 'none'} />
          </IconBtn>
          {canImprove && !offlineCopy && <IconBtn title={canEdit ? 'Editar' : 'Melhorar esta publicação'} onClick={() => nav(`/t/${t.short_code}/editar`)}><Pencil className="size-[18px]" /></IconBtn>}
          {canEdit && <IconBtn title="Excluir" onClick={() => setConfirmDel(true)} className="text-[#ff3b30]"><Trash2 className="size-[18px]" /></IconBtn>}
          <IconBtn title="Compartilhar" onClick={quickShare}><Share className="size-[18px]" /></IconBtn>
        </div>
      </div>

      {offlineCopy && (
        <div className="no-print mb-4 flex items-center gap-3 rounded-[12px] bg-neutral-900/[.05] px-4 py-3 text-[14px] text-neutral-700 dark:bg-white/10 dark:text-neutral-300">
          <WifiOff className="size-5 shrink-0 text-neutral-500" />
          Você está vendo a cópia offline salva {timeAgo(offlineCopy.savedAt)}. Comentários e avaliações voltam quando houver internet.
        </div>
      )}
      {!offlineCopy && canEdit && (reviewDue || outdated > 0) && (
        <div className="no-print mb-4 flex flex-col gap-3 rounded-[12px] bg-brand-orange/10 px-4 py-3 sm:flex-row sm:items-center">
          <CalendarCheck className="size-5 shrink-0 text-brand-orange" />
          <div className="min-w-0 flex-1 text-[14px] text-neutral-800 dark:text-neutral-200">
            <b>Revisão pendente.</b> {reviewDue ? `Última revisão ${timeAgo(t.reviewed_at!)} (a cada ${t.review_interval_months ?? 6} meses).` : ''}
            {outdated > 0 && ` ${outdated} relato${outdated > 1 ? 's' : ''} de passo desatualizado.`} Confira os passos, ajuste o que for preciso e confirme.
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => nav(`/t/${t.short_code}/editar`)}>Editar</Button>
            <Button size="sm" onClick={markReviewed}><CheckCircle2 className="size-4" />Marcar como revisado</Button>
          </div>
        </div>
      )}

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
              {t.kind === 'quick' && <><span className="text-neutral-300 dark:text-neutral-700">·</span><span className="text-brand-orange-dark">Dica rápida</span></>}
              {t.status === 'draft' && <><span className="text-neutral-300 dark:text-neutral-700">·</span><span className="text-[#ff9500]">Rascunho — visível só para você e moderadores</span></>}
            </div>
            {t.verified_at && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <VerifiedBadge size="md" />
                <span className="text-[13px] text-neutral-500">{t.verifier?.full_name ? `por ${t.verifier.full_name} · ` : ''}{timeAgo(t.verified_at)}</span>
              </div>
            )}
            <h1 className="mt-2 text-[28px] font-bold leading-[1.15] tracking-tight text-neutral-900 sm:text-[36px] dark:text-white">{t.title}</h1>
            {t.summary && <p className="mt-3 text-[17px] leading-relaxed text-neutral-500 sm:text-[19px]">{t.summary}</p>}
            <div className="mt-5 flex items-center gap-3">
              <Link to={`/pessoa/${t.author_id}`}><Avatar name={t.author?.full_name} email={t.author?.email} url={t.author?.avatar_url} size={36} /></Link>
              <div className="min-w-0 flex-1 text-[13px] leading-tight">
                <Link to={`/pessoa/${t.author_id}`} className="block truncate text-[15px] font-medium text-neutral-900 hover:underline dark:text-neutral-100">{t.author?.full_name}{authorCd && <span className="ml-1.5 rounded-md bg-accent-500/10 px-1.5 py-px align-middle text-[11px] font-semibold text-accent-700 dark:text-accent-300">{authorCd}</span>}</Link>
                <div className="mt-0.5 text-neutral-500">{fmtDate(t.created_at)} · {readingTime(t.content_html)} min de leitura · {viewers?.length ?? '–'} {viewers?.length === 1 ? 'leitor' : 'leitores'}</div>
              </div>
              {t.author_id !== profile?.id && (
                <button onClick={() => follows.toggle({ author: t.author_id }, t.author?.full_name ?? 'autor')}
                  className={cn('no-print press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium',
                    follows.isFollowing({ author: t.author_id }) ? 'bg-neutral-900/[.06] text-neutral-700 dark:bg-white/10 dark:text-neutral-300' : 'bg-accent-500/10 text-accent-700 dark:text-accent-300')}>
                  {follows.isFollowing({ author: t.author_id }) ? <UserCheck className="size-3.5" /> : <UserPlus className="size-3.5" />}
                  {follows.isFollowing({ author: t.author_id }) ? 'Seguindo' : 'Seguir'}
                </button>
              )}
            </div>
            {(improvedByOther || contributors.length > 0) && (
              <div className="no-print mt-5 rounded-[12px] border border-accent-500/25 bg-accent-500/[.06] px-4 py-3">
                {improvedByOther && (
                  <div className="flex items-center gap-2 text-[14px] text-neutral-800 dark:text-neutral-200">
                    <Pencil className="size-4 shrink-0 text-accent-600" />
                    <span><b>Melhorado por {t.editor?.full_name}</b> {timeAgo(t.updated_at)}{(() => { const c = contributors.find(x => x.full_name === t.editor?.full_name); return c?.cd_name ? ` · ${c.cd_name}` : '' })()}</span>
                  </div>
                )}
                {contributors.length > 0 && (
                  <div className={cn('flex flex-wrap items-center gap-1.5 text-[12px] text-neutral-600 dark:text-neutral-400', improvedByOther && 'mt-2')}>
                    <span className="font-medium">Colaboraram:</span>
                    {contributors.map(c => (
                      <Link key={c.user_id} to={`/pessoa/${c.user_id}`} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 shadow-[0_0_0_0.5px_rgb(0_0_0/0.1)] dark:bg-neutral-800">
                        <Avatar name={c.full_name} url={c.avatar_url} size={16} />{c.full_name}{c.cd_name ? ` · ${c.cd_name}` : ''}
                      </Link>
                    ))}
                    <button onClick={() => setHistory(true)} className="ml-1 font-medium text-accent-600 dark:text-accent-400">ver o que mudou</button>
                  </div>
                )}
              </div>
            )}
            {outdated > 0 && (
              <button onClick={() => document.getElementById('comentarios')?.scrollIntoView({ behavior: 'smooth' })}
                className="no-print mt-5 flex w-full items-center gap-3 rounded-[12px] bg-brand-orange/10 px-4 py-3 text-left">
                <AlertTriangle className="size-5 shrink-0 text-brand-orange" />
                <span className="flex-1 text-[14px] text-neutral-800 dark:text-neutral-200">
                  <b>{outdated} {outdated === 1 ? 'colega reportou' : 'colegas reportaram'}</b> que algum passo pode estar desatualizado. Veja os comentários antes de seguir.
                </span>
              </button>
            )}
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
            {t.reviewed_at && <> · {reviewDue ? <span className="font-medium text-brand-orange">revisão pendente</span> : <>revisado {timeAgo(t.reviewed_at)}</>}</>}
          </p>
          {!offlineCopy && t.kind === 'quick' && canImprove && (
            <div className="no-print mx-auto mt-6 flex max-w-[720px] flex-col gap-3 rounded-[14px] bg-brand-orange/[.08] p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 text-[14px] text-neutral-700 dark:text-neutral-300">
                <b>Esta é uma dica rápida.</b> Quando tiver um tempinho, transforme em tutorial completo com mais passos, prints e anexos.
              </div>
              <Button size="sm" variant="secondary" onClick={() => nav(`/t/${t.short_code}/editar`)}>Transformar em tutorial</Button>
            </div>
          )}
          {!offlineCopy && isModerator && (
            <div className="no-print mx-auto mt-6 flex max-w-[720px] flex-col gap-3 rounded-[14px] bg-accent-500/[.07] p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 text-[14px] text-neutral-700 dark:text-neutral-300">
                {t.verified_at
                  ? <><b>Tutorial verificado.</b> Se o conteúdo for alterado, a verificação é removida automaticamente.</>
                  : <><b>Revisou este tutorial?</b> Marque como verificado: ele ganha o selo e aparece primeiro na busca e na biblioteca.</>}
              </div>
              <Button size="sm" variant={t.verified_at ? 'secondary' : 'primary'} loading={verifying} onClick={toggleVerified}>
                {t.verified_at ? 'Remover verificação' : 'Marcar como verificado'}
              </Button>
            </div>
          )}
          {trail && <TrailBar trail={trail} />}
          {!offlineCopy && (
            <div className="no-print mx-auto mt-6 max-w-[720px] space-y-8">
              <Feedback tutorialId={t.id} onNotHelpful={() => setPrompt({ kind: 'outdated', n: Date.now() })} />
              <ThanksBox tutorialId={t.id} authorId={t.author_id} authorName={t.author?.full_name} />
              <Comments tutorialId={t.id} ownerId={t.author_id} prompt={prompt} />
            </div>
          )}
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

      {!offlineCopy && history && <Suspense fallback={null}><VersionHistory open={history} onClose={() => setHistory(false)} tutorialId={t.id} canRestore={canImprove} onRestored={() => setReload(r => r + 1)} /></Suspense>}
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

function TrailBar({ trail }: { trail: NonNullable<ReturnType<typeof useTrailNav>> }) {
  const nav = useNavigate()
  return (
    <div className="no-print mx-auto mt-8 max-w-[720px]">
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center" style={{ boxShadow: `inset 0 0 0 1.5px ${trail.color}55` }}>
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] text-white" style={{ background: trail.color }}><Route className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-neutral-500">Trilha · passo {trail.index + 1} de {trail.total}</div>
          <div className="truncate text-[15px] font-semibold text-neutral-900 dark:text-white">{trail.title}</div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"><div className="h-full rounded-full transition-all" style={{ width: `${(trail.done / trail.total) * 100}%`, background: trail.color }} /></div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => nav(`/trilhas/${trail.id}`)}>Ver trilha</Button>
          <Button size="sm" onClick={async () => { await trail.complete(); if (trail.next) nav(`/t/${trail.next}?trilha=${trail.id}`); else nav(`/trilhas/${trail.id}`) }}>
            {trail.completed ? (trail.next ? <>Próximo<ChevronRight className="size-4" /></> : 'Concluir') : <><CheckCircle2 className="size-4" />{trail.next ? 'Concluir e avançar' : 'Concluir trilha'}</>}
          </Button>
        </div>
      </div>
    </div>
  )
}
