import { useEffect, useMemo, useState } from 'react'
import { diffWords } from 'diff'
import { History, RotateCcw, Eye, GitCompare, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { cn, errMsg, fmtDateTime, timeAgo } from '../lib/utils'
import { Avatar, Button, Modal, Spinner } from './ui'
import TutorialContent from './TutorialContent'

interface Version {
  id: number; version: number; title: string; summary: string | null; content_html: string
  note: string | null; created_at: string; edited_by: string | null
  editor?: { full_name: string | null; email: string; avatar_url: string | null } | null
}

const plain = (v: Version) => [v.title, v.summary ?? '', v.content_html
  .replace(/<\/(p|h[1-6]|li|pre|tr|div|blockquote)>/g, '\n').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')].join('\n\n').replace(/\n{3,}/g, '\n\n').trim()

export default function VersionHistory({ open, onClose, tutorialId, canRestore, onRestored }: {
  open: boolean; onClose: () => void; tutorialId: string; canRestore: boolean; onRestored: () => void
}) {
  const [items, setItems] = useState<Version[] | null>(null)
  const [view, setView] = useState<{ mode: 'view' | 'diff'; v: Version } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setItems(null); setView(null)
    supabase.from('kb_tutorial_versions')
      .select('id,version,title,summary,content_html,note,created_at,edited_by,editor:kb_profiles!kb_tutorial_versions_edited_by_fkey(full_name,email,avatar_url)')
      .eq('tutorial_id', tutorialId).order('version', { ascending: false })
      .then(({ data }) => setItems((data as unknown as Version[]) ?? []))
  }, [open, tutorialId])

  const prevOf = (v: Version) => items?.find(x => x.version < v.version)
  const restore = async (v: Version) => {
    if (!confirm(`Restaurar a versão ${v.version}? O conteúdo atual vira uma versão no histórico e pode ser recuperado depois.`)) return
    setBusy(true)
    const { error } = await supabase.rpc('kb_restore_version', { p_version: v.id })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success(`Versão ${v.version} restaurada`)
    onClose(); onRestored()
  }

  return (
    <Modal open={open} onClose={onClose} wide title={view ? `Versão ${view.v.version} · ${view.mode === 'diff' ? 'o que mudou' : 'visualização'}` : 'Histórico de versões'}>
      {!items ? <Spinner /> : view ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setView(null)}><ChevronLeft className="size-4" />Voltar</Button>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setView({ mode: view.mode === 'diff' ? 'view' : 'diff', v: view.v })}>
                {view.mode === 'diff' ? <><Eye className="size-4" />Ver versão</> : <><GitCompare className="size-4" />O que mudou</>}
              </Button>
              {canRestore && view.v.version !== items[0].version && (
                <Button size="sm" loading={busy} onClick={() => restore(view.v)}><RotateCcw className="size-4" />Restaurar esta versão</Button>
              )}
            </div>
          </div>
          {view.mode === 'view'
            ? <div className="rounded-[12px] border border-neutral-200 p-5 dark:border-neutral-800"><h2 className="mb-4 text-[22px] font-bold">{view.v.title}</h2><TutorialContent html={view.v.content_html} /></div>
            : <Diff a={prevOf(view.v)} b={view.v} />}
        </div>
      ) : (
        <ol className="relative space-y-1 border-l border-neutral-200 pl-5 dark:border-neutral-800">
          {items.map((v, i) => (
            <li key={v.id} className="relative">
              <span className={cn('absolute -left-[27px] top-4 size-3 rounded-full ring-4 ring-white dark:ring-neutral-900', i === 0 ? 'bg-accent-500' : 'bg-neutral-300 dark:bg-neutral-600')} />
              <div className="flex flex-wrap items-center gap-3 rounded-[12px] px-3 py-3 hover:bg-neutral-900/[.03] dark:hover:bg-white/[.04]">
                <Avatar name={v.editor?.full_name} email={v.editor?.email} url={v.editor?.avatar_url} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium text-neutral-900 dark:text-white">
                    Versão {v.version}{i === 0 && <span className="ml-2 rounded-md bg-accent-500/10 px-1.5 py-px text-[11px] font-semibold text-accent-700 dark:text-accent-300">atual</span>}
                  </div>
                  <div className="text-[13px] text-neutral-500" title={fmtDateTime(v.created_at)}>
                    {v.editor?.full_name ?? 'Sistema'} · {timeAgo(v.created_at)}{v.note && ` · ${v.note}`}
                  </div>
                </div>
                <div className="flex gap-1">
                  {prevOf(v) && <Button size="sm" variant="ghost" onClick={() => setView({ mode: 'diff', v })}><GitCompare className="size-4" /><span className="hidden sm:inline">O que mudou</span></Button>}
                  <Button size="sm" variant="ghost" onClick={() => setView({ mode: 'view', v })}><Eye className="size-4" /><span className="hidden sm:inline">Ver</span></Button>
                  {canRestore && i > 0 && <Button size="sm" variant="ghost" onClick={() => restore(v)} loading={busy}><RotateCcw className="size-4" /><span className="hidden sm:inline">Restaurar</span></Button>}
                </div>
              </div>
            </li>
          ))}
          {items.length === 0 && <li className="flex items-center gap-2 py-6 text-neutral-500"><History className="size-4" />Sem versões registradas.</li>}
        </ol>
      )}
    </Modal>
  )
}

function Diff({ a, b }: { a?: Version; b: Version }) {
  const parts = useMemo(() => diffWords(a ? plain(a) : '', plain(b)), [a, b])
  const added = parts.filter(p => p.added).reduce((n, p) => n + p.value.split(/\s+/).filter(Boolean).length, 0)
  const removed = parts.filter(p => p.removed).reduce((n, p) => n + p.value.split(/\s+/).filter(Boolean).length, 0)
  return (
    <div>
      <div className="mb-3 flex gap-3 text-[13px]">
        <span className="rounded-md bg-[#34c759]/15 px-2 py-0.5 font-medium text-[#248a3d] dark:text-[#30d158]">+{added} palavras</span>
        <span className="rounded-md bg-[#ff3b30]/15 px-2 py-0.5 font-medium text-[#d70015] dark:text-[#ff453a]">−{removed} palavras</span>
        <span className="text-neutral-500">comparado com a versão {a?.version ?? '—'}</span>
      </div>
      <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-[12px] bg-neutral-50 p-4 text-[15px] leading-relaxed text-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300">
        {parts.map((p, i) => p.added
          ? <ins key={i} className="rounded bg-[#34c759]/20 text-[#1d6b30] no-underline dark:text-[#30d158]">{p.value}</ins>
          : p.removed ? <del key={i} className="rounded bg-[#ff3b30]/15 text-[#b3261e] dark:text-[#ff6961]">{p.value}</del>
          : <span key={i}>{p.value}</span>)}
      </div>
    </div>
  )
}
