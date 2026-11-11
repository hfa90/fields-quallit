import { useState } from 'react'
import { Download, Eye, FileText, FileImage, FileVideo, FileArchive, FileSpreadsheet, Presentation, File, ExternalLink, Loader2, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, ATTACHMENTS_BUCKET } from '../lib/supabase'
import type { Attachment, LinkItem } from '../lib/types'
import { FILE_STYLE, fileKind, fileSize, hostOf, errMsg, type FileKind } from '../lib/utils'
import { Modal } from './ui'
import { offlineAttachmentUrl } from '../lib/offline'

export function FileIcon({ kind, className }: { kind: FileKind; className?: string }) {
  const I = { pdf: FileText, word: FileText, powerpoint: Presentation, excel: FileSpreadsheet, image: FileImage, video: FileVideo, archive: FileArchive, text: FileText, other: File }[kind]
  return <I className={className} />
}

async function signed(path: string, download?: string) {
  const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(path, 3600, download ? { download } : undefined)
  if (error) throw error
  return data.signedUrl
}

export function AttachmentList({ items }: { items: Attachment[] }) {
  const [preview, setPreview] = useState<{ a: Attachment; url: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const resolve = async (a: Attachment, download?: string) => {
    if (!navigator.onLine) {
      const local = await offlineAttachmentUrl(a.id)
      if (local) return local
      throw new Error('Sem internet e este anexo não foi salvo para uso offline')
    }
    try { return await signed(a.storage_path, download) }
    catch (e) { const local = await offlineAttachmentUrl(a.id); if (local) return local; throw e }
  }
  const open = async (a: Attachment) => {
    setBusy(a.id)
    try {
      const url = await resolve(a)
      const k = fileKind(a.file_name, a.mime_type)
      if (['pdf', 'image', 'video', 'word', 'powerpoint', 'excel', 'text'].includes(k)) setPreview({ a, url })
      else window.open(url, '_blank', 'noopener')
    } catch (e) { toast.error(errMsg(e)) } finally { setBusy(null) }
  }
  const download = async (a: Attachment) => {
    setBusy(a.id)
    try {
      const url = await resolve(a, a.file_name)
      if (url.startsWith('blob:')) { const el = document.createElement('a'); el.href = url; el.download = a.file_name; el.click() }
      else window.location.href = url
    }
    catch (e) { toast.error(errMsg(e)) } finally { setBusy(null) }
  }

  return (
    <>
      <ul className="space-y-2">
        {items.map(a => {
          const k = fileKind(a.file_name, a.mime_type)
          const st = FILE_STYLE[k]
          return (
            <li key={a.id} className="group flex items-center gap-3 rounded-xl card p-2.5 transition hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg text-white" style={{ background: st.color }}>
                <FileIcon kind={k} className="size-5" />
              </span>
              <button onClick={() => open(a)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-neutral-800 group-hover:text-accent-600 dark:text-neutral-200">{a.file_name}</div>
                <div className="text-xs text-neutral-400">{st.label} · {fileSize(a.size_bytes)}</div>
              </button>
              {busy === a.id ? <Loader2 className="size-4 animate-spin text-neutral-400" /> : (
                <div className="flex shrink-0 gap-0.5">
                  <button onClick={() => open(a)} title="Visualizar" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"><Eye className="size-4" /></button>
                  <button onClick={() => download(a)} title="Baixar" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"><Download className="size-4" /></button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {preview && <PreviewModal a={preview.a} url={preview.url} onClose={() => setPreview(null)} onDownload={() => download(preview.a)} />}
    </>
  )
}

function PreviewModal({ a, url, onClose, onDownload }: { a: Attachment; url: string; onClose: () => void; onDownload: () => void }) {
  const k = fileKind(a.file_name, a.mime_type)
  const office = k === 'word' || k === 'powerpoint' || k === 'excel'
  const [useOffice, setUseOffice] = useState(false)
  return (
    <Modal open onClose={onClose} title={a.file_name} wide>
      <div className="space-y-3">
        {k === 'pdf' && <iframe src={url} title={a.file_name} className="h-[70vh] w-full rounded-xl border border-neutral-200 dark:border-neutral-800" />}
        {k === 'image' && <img src={url} alt={a.file_name} className="mx-auto max-h-[70vh] rounded-xl" />}
        {k === 'video' && <video src={url} controls className="w-full rounded-xl" />}
        {k === 'text' && <iframe src={url} title={a.file_name} className="h-[60vh] w-full rounded-xl border border-neutral-200 bg-white dark:border-neutral-800" />}
        {office && (useOffice ? (
          <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} title={a.file_name} className="h-[70vh] w-full rounded-xl border border-neutral-200 dark:border-neutral-800" />
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-neutral-200 p-8 text-center dark:border-neutral-700">
            <span className="mx-auto grid size-14 place-items-center rounded-xl text-white" style={{ background: FILE_STYLE[k].color }}><FileIcon kind={k} className="size-7" /></span>
            <p className="mt-4 font-semibold text-neutral-800 dark:text-neutral-100">Arquivo {FILE_STYLE[k].label}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">Baixe para abrir no Office, ou visualize online pelo Microsoft Office Viewer (o arquivo é enviado temporariamente ao serviço da Microsoft).</p>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={onDownload} className="inline-flex items-center gap-1.5 rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500"><Download className="size-4" />Baixar</button>
              <button onClick={() => setUseOffice(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"><Eye className="size-4" />Visualizar online</button>
            </div>
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"><ExternalLink className="size-4" />Abrir em nova aba</a>
          <button onClick={onDownload} className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200"><Download className="size-4" />Baixar</button>
        </div>
      </div>
    </Modal>
  )
}

export function LinkList({ items }: { items: LinkItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((l, i) => (
        <li key={l.id ?? i}>
          <a href={l.url} target="_blank" rel="noopener noreferrer nofollow"
            className="group flex items-center gap-3 rounded-xl card p-2.5 transition hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-50 text-accent-500 dark:bg-accent-500/10"><Globe className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-neutral-800 group-hover:text-accent-600 dark:text-neutral-200">{l.title || hostOf(l.url)}</div>
              <div className="truncate text-xs text-neutral-400">{hostOf(l.url)}</div>
            </div>
            <ExternalLink className="size-4 shrink-0 text-neutral-300 group-hover:text-accent-500" />
          </a>
        </li>
      ))}
    </ul>
  )
}
