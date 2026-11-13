import { useEffect, useState } from 'react'
import { zipSync, strToU8 } from 'fflate'
import { Download, DatabaseBackup, CloudUpload, ShieldCheck, Loader2, Clock, FileArchive } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, ATTACHMENTS_BUCKET } from '../lib/supabase'
import { errMsg, fileSize, fmtDateTime, timeAgo } from '../lib/utils'
import { Button, Spinner } from '../components/ui'

const BACKUPS = 'kb-backups'

// Tudo o que um administrador pode ler (rascunhos, segredos e inscrições push são pessoais e ficam de fora)
const TABLES = [
  'kb_profiles', 'kb_settings', 'kb_categories', 'kb_tutorials', 'kb_tutorial_versions', 'kb_links', 'kb_attachments',
  'kb_comments', 'kb_feedback', 'kb_favorites', 'kb_follows', 'kb_requests', 'kb_request_votes',
  'kb_trails', 'kb_trail_items', 'kb_trail_progress', 'kb_views', 'kb_search_log', 'kb_thanks', 'kb_locations',
]

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'tutorial'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

interface Tut { id: string; short_code: string; title: string; summary: string | null; content_html: string; created_at: string; updated_at: string; author_id: string; status: string; verified_at: string | null }
interface Att { id: string; tutorial_id: string; storage_path: string; file_name: string }
interface Prof { id: string; full_name: string | null; email: string }

/** Página HTML legível de um tutorial, abrindo sem internet */
function tutorialHtml(t: Tut, author: string, files: Att[], localMedia: (u: string) => string) {
  const body = t.content_html.replace(/(src)="([^"]+)"/g, (_m, a, u) => `${a}="${localMedia(u.replace(/&amp;/g, '&'))}"`)
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.title)}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;max-width:760px;margin:32px auto;padding:0 20px;color:#1c1c1e;line-height:1.65}
h1{font-size:28px;letter-spacing:-.02em;margin:0 0 6px}.meta{color:#8e8e93;font-size:14px;margin-bottom:24px}
img,video{max-width:100%;border-radius:10px}pre{background:#1c1c1e;color:#f5f5f7;padding:14px;border-radius:10px;overflow:auto}
code{font-family:SF Mono,Menlo,Consolas,monospace}table{border-collapse:collapse;width:100%}td,th{border:1px solid #e2e2e7;padding:6px 10px}
div[data-callout]{background:#eef8f9;border-left:4px solid #1a9ca9;padding:10px 14px;border-radius:8px}
.files{margin-top:32px;padding:16px;background:#f5f5f7;border-radius:12px}.files a{color:#15828d}</style></head><body>
<p><a href="../index.html">← Todos os tutoriais</a></p>
<h1>${esc(t.title)}</h1>
<div class="meta">${esc(author)} · criado em ${new Date(t.created_at).toLocaleDateString('pt-BR')} · atualizado em ${new Date(t.updated_at).toLocaleDateString('pt-BR')}${t.verified_at ? ' · ✔ Verificado' : ''}${t.status === 'draft' ? ' · Rascunho' : ''}</div>
${t.summary ? `<p><em>${esc(t.summary)}</em></p>` : ''}
${body}
${files.length ? `<div class="files"><strong>Anexos</strong><ul>${files.map(f => `<li><a href="../anexos/${t.short_code}/${encodeURIComponent(f.file_name)}">${esc(f.file_name)}</a></li>`).join('')}</ul></div>` : ''}
</body></html>`
}

export default function BackupTab() {
  const [snaps, setSnaps] = useState<{ name: string; size: number; created_at: string }[] | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const loadSnaps = async () => {
    const { data } = await supabase.storage.from(BACKUPS).list('snapshots', { limit: 100, sortBy: { column: 'name', order: 'desc' } })
    setSnaps((data ?? []).filter(f => f.name.endsWith('.zip')).map(f => ({ name: f.name, size: Number(f.metadata?.size ?? 0), created_at: f.created_at ?? '' })))
  }
  useEffect(() => { loadSnaps() }, [])

  /** Backup completo gerado na hora, com arquivos dentro do .zip */
  const downloadFull = async () => {
    setProgress('Lendo dados…')
    try {
      const files: Record<string, Uint8Array> = {}
      const data: Record<string, unknown[]> = {}
      for (const t of TABLES) {
        setProgress(`Lendo ${t.replace('kb_', '').replace(/_/g, ' ')}…`)
        const rows: unknown[] = []
        for (let from = 0; ; from += 1000) {
          const cols = t === 'kb_tutorials' ? 'id,short_code,title,summary,content_html,content_json,category_id,tags,difficulty,status,author_id,updated_by,created_at,updated_at,review_interval_months,reviewed_at,reviewed_by,verified_at,verified_by,kind' : '*'
          const { data: page, error } = await supabase.from(t).select(cols).range(from, from + 999)
          if (error) throw new Error(`${t}: ${error.message}`)
          rows.push(...(page ?? []))
          if (!page || page.length < 1000) break
        }
        data[t] = rows
        files[`dados/${t}.json`] = strToU8(JSON.stringify(rows, null, 1))
      }

      const tuts = data.kb_tutorials as Tut[]
      const atts = data.kb_attachments as Att[]
      const people = new Map((data.kb_profiles as Prof[]).map(p => [p.id, p.full_name || p.email]))
      const codeOf = new Map(tuts.map(t => [t.id, t.short_code]))

      // Anexos
      let i = 0
      for (const a of atts) {
        i++; setProgress(`Baixando anexos ${i}/${atts.length}…`)
        const { data: blob } = await supabase.storage.from(ATTACHMENTS_BUCKET).download(a.storage_path)
        if (blob) files[`anexos/${codeOf.get(a.tutorial_id) ?? 'sem-tutorial'}/${a.file_name}`] = new Uint8Array(await blob.arrayBuffer())
      }

      // Imagens e vídeos usados nos tutoriais
      const media = new Map<string, string>()
      for (const t of tuts) for (const m of t.content_html.matchAll(/src="(https:[^"]+\/storage\/v1\/object\/public\/kb-images\/[^"]+)"/g)) {
        const url = m[1].replace(/&amp;/g, '&')
        media.set(url, `midia/${decodeURIComponent(url.split('/kb-images/')[1])}`)
      }
      i = 0
      for (const [url, path] of media) {
        i++; setProgress(`Baixando imagens e vídeos ${i}/${media.size}…`)
        try { const r = await fetch(url); if (r.ok) files[path] = new Uint8Array(await r.arrayBuffer()) } catch { /* segue */ }
      }

      // Páginas legíveis + índice
      setProgress('Montando páginas dos tutoriais…')
      const list: string[] = []
      for (const t of tuts) {
        const name = `tutoriais/${t.short_code}-${slug(t.title)}.html`
        files[name] = strToU8(tutorialHtml(t, people.get(t.author_id) ?? '', atts.filter(a => a.tutorial_id === t.id), u => media.has(u) ? `../${media.get(u)}` : u))
        list.push(`<li><a href="${name}">${esc(t.title)}</a> <small>· ${esc(people.get(t.author_id) ?? '')}${t.verified_at ? ' · ✔ Verificado' : ''}</small></li>`)
      }
      const now = new Date()
      files['index.html'] = strToU8(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Backup Fields</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;max-width:760px;margin:32px auto;padding:0 20px;color:#1c1c1e}a{color:#15828d}li{margin:6px 0}small{color:#8e8e93}</style></head>
<body><h1>Backup · Fields Quallit</h1><p>Gerado em ${now.toLocaleString('pt-BR')} · ${tuts.length} tutoriais · ${atts.length} anexos · ${people.size} usuários</p>
<ul>${list.join('')}</ul><p><small>Os dados completos (para restauração) estão na pasta <b>dados/</b> em formato JSON.</small></p></body></html>`)
      files['LEIA-ME.txt'] = strToU8(`Backup completo da central Fields (Quallit Soluções em TI)
Gerado em: ${now.toLocaleString('pt-BR')}

index.html     -> abra no navegador para ler todos os tutoriais sem internet
tutoriais/     -> uma página por tutorial
anexos/        -> arquivos anexados (PDF, Word...), separados pelo código do tutorial
midia/         -> imagens e vídeos usados dentro dos tutoriais
dados/         -> todas as tabelas em JSON (tutoriais, versões, comentários, usuários, trilhas...) para restauração
`)

      setProgress('Compactando…')
      await new Promise(r => setTimeout(r, 30))
      const zip = zipSync(files, { level: 6 })
      const blob = new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `fields-backup-completo-${now.toISOString().slice(0, 10)}.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 30000)
      toast.success(`Backup baixado (${fileSize(zip.byteLength)})`)
    } catch (e) { toast.error(errMsg(e)) } finally { setProgress(null) }
  }

  const runNow = async () => {
    setRunning(true)
    const { data, error } = await supabase.functions.invoke('kb-backup', { body: { source: 'manual' } })
    setRunning(false)
    if (error || data?.error) return toast.error(errMsg(error ?? data.error))
    toast.success('Cópia de segurança criada', { description: `${data.copied} arquivo(s) novo(s) guardado(s)` })
    loadSnaps()
  }

  const downloadSnap = async (name: string) => {
    const { data, error } = await supabase.storage.from(BACKUPS).createSignedUrl(`snapshots/${name}`, 300, { download: name })
    if (error) return toast.error(errMsg(error))
    window.location.href = data.signedUrl
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card space-y-4 p-5">
        <h3 className="flex items-center gap-2 text-[17px] font-semibold text-neutral-900 dark:text-white"><FileArchive className="size-5 text-accent-600" />Backup completo</h3>
        <p className="text-[14px] text-neutral-500">Baixa agora, para o seu computador, um arquivo .zip com <b>tutoriais</b> (com histórico de versões), <b>comentários</b>, <b>usuários</b>, <b>anexos</b>, imagens, vídeos, trilhas e estatísticas. Inclui páginas que abrem no navegador mesmo sem internet.</p>
        <Button className="h-11 w-full" onClick={downloadFull} disabled={!!progress}>
          {progress ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}{progress ?? 'Baixar backup completo'}
        </Button>
        <p className="flex items-start gap-2 text-[12px] text-neutral-500"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-600" />Guarde o arquivo em local seguro (ex.: drive da empresa). Ele contém dados de usuários.</p>
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[17px] font-semibold text-neutral-900 dark:text-white"><DatabaseBackup className="size-5 text-accent-600" />Cópias automáticas</h3>
          <Button size="sm" variant="tinted" onClick={runNow} loading={running}><CloudUpload className="size-4" />Fazer cópia agora</Button>
        </div>
        <p className="text-[14px] text-neutral-500">Toda <b>domingo às 3h</b> o sistema guarda uma cópia num espaço privado (só administradores acessam). Ficam as <b>8 mais recentes</b>; anexos e imagens são copiados e nunca apagados por lá.</p>
        {!snaps ? <Spinner /> : snaps.length === 0 ? <p className="text-[14px] text-neutral-400">Nenhuma cópia ainda.</p> : (
          <ul className="divide-y divide-neutral-200/70 overflow-hidden rounded-[12px] bg-neutral-50 dark:divide-neutral-800 dark:bg-neutral-800/50">
            {snaps.map(s => (
              <li key={s.name} className="flex items-center gap-3 px-3 py-2.5">
                <Clock className="size-4 shrink-0 text-neutral-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-neutral-900 dark:text-white">{s.created_at ? fmtDateTime(s.created_at) : s.name}</div>
                  <div className="text-[12px] text-neutral-500">{s.created_at && timeAgo(s.created_at)} · {fileSize(s.size)}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => downloadSnap(s.name)}><Download className="size-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
