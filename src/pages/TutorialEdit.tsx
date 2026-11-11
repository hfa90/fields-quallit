import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, Send, UploadCloud, X, Plus, Link2, Paperclip, ArrowLeft, Trash2, Tag, Info } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, ATTACHMENTS_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Attachment, Category, Difficulty, LinkItem, Status, Tutorial } from '../lib/types'
import { DIFFICULTY, FILE_STYLE, cn, errMsg, fileKind, fileSize, safeFileName } from '../lib/utils'
import RichEditor from '../components/editor/RichEditor'
import { FileIcon } from '../components/Attachments'
import { Button, Spinner, inputCls, labelCls } from '../components/ui'
import NotFound from './NotFound'

const MAX_FILE = 50 * 1024 * 1024
const ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.ppt,.pptx,.pps,.ppsx,.odp,.xls,.xlsx,.csv,.ods,.txt,.log,.md,.json,.xml,.ps1,.sh,.bat,.conf,.ovpn,.cfg,.ini,.zip,.rar,.7z,.png,.jpg,.jpeg,.gif,.webp,.svg,.mp4,.webm,.mov'

interface NewFile { key: string; file: File }

export default function TutorialEdit() {
  const { code } = useParams()
  const isNew = !code
  const nav = useNavigate()
  const { profile, isModerator } = useAuth()

  const [loaded, setLoaded] = useState<Tutorial | null | undefined>(isNew ? null : undefined)
  const [cats, setCats] = useState<Category[]>([])
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('basico')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [links, setLinks] = useState<LinkItem[]>([])
  const [existing, setExisting] = useState<Attachment[]>([])
  const [removed, setRemoved] = useState<Attachment[]>([])
  const [newFiles, setNewFiles] = useState<NewFile[]>([])
  const [drag, setDrag] = useState(false)
  const [saving, setSaving] = useState<Status | null>(null)
  const [progress, setProgress] = useState('')
  const content = useRef<{ json: unknown; html: string }>({ json: null, html: '' })
  const dirty = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('kb_categories').select('*').order('sort_order').then(({ data }) => setCats(data ?? []))
  }, [])

  useEffect(() => {
    if (isNew) return
    ;(async () => {
      const { data } = await supabase.from('kb_tutorials').select('*').eq('short_code', code!).maybeSingle()
      if (!data) { setLoaded(null); return }
      const t = data as Tutorial
      setTitle(t.title); setSummary(t.summary ?? ''); setCategoryId(t.category_id ?? '')
      setDifficulty(t.difficulty); setTags(t.tags)
      content.current = { json: t.content_json, html: t.content_html }
      const [l, a] = await Promise.all([
        supabase.from('kb_links').select('*').eq('tutorial_id', t.id).order('sort_order'),
        supabase.from('kb_attachments').select('*').eq('tutorial_id', t.id).order('created_at'),
      ])
      setLinks(l.data ?? []); setExisting(a.data ?? [])
      setLoaded(t)
    })()
  }, [code, isNew])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault() } }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])

  if (!isNew && loaded === undefined) return <Spinner label="Carregando tutorial…" />
  if (!isNew && loaded === null) return <NotFound message="Tutorial não encontrado" />
  if (loaded && !(isModerator || loaded.author_id === profile?.id)) return <NotFound message="Você não tem permissão para editar este tutorial" />

  const touch = () => { dirty.current = true }

  const addFiles = (list: FileList | File[]) => {
    const arr = Array.from(list)
    const big = arr.filter(f => f.size > MAX_FILE)
    if (big.length) toast.error(`Arquivo(s) acima de 50 MB ignorado(s): ${big.map(f => f.name).join(', ')}`)
    setNewFiles(prev => [...prev, ...arr.filter(f => f.size <= MAX_FILE).map(file => ({ key: crypto.randomUUID(), file }))])
    touch()
  }

  const addTag = (raw: string) => {
    const v = raw.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-').slice(0, 30)
    if (v && !tags.includes(v) && tags.length < 12) { setTags([...tags, v]); touch() }
    setTagInput('')
  }

  const save = async (status: Status) => {
    if (title.trim().length < 3) { toast.error('Dê um título ao tutorial (mínimo 3 caracteres)'); return }
    const cleanLinks = links.map(l => ({ ...l, url: l.url.trim() })).filter(l => l.url)
    const badLink = cleanLinks.find(l => !/^https?:\/\/\S+\.\S+/i.test(l.url))
    if (badLink) { toast.error(`Link inválido: ${badLink.url} (use http:// ou https://)`); return }

    setSaving(status)
    try {
      const id = loaded?.id ?? crypto.randomUUID()
      const payload = {
        title: title.trim(),
        summary: summary.trim() || null,
        category_id: categoryId || null,
        difficulty,
        tags,
        status,
        content_json: content.current.json,
        content_html: content.current.html,
      }
      setProgress('Salvando conteúdo…')
      const res = loaded
        ? await supabase.from('kb_tutorials').update(payload).eq('id', id).select('short_code').single()
        : await supabase.from('kb_tutorials').insert({ id, ...payload }).select('short_code').single()
      if (res.error) throw res.error
      const shortCode = res.data.short_code as string

      // Links: regrava a lista
      setProgress('Salvando links…')
      const del = await supabase.from('kb_links').delete().eq('tutorial_id', id)
      if (del.error) throw del.error
      if (cleanLinks.length) {
        const ins = await supabase.from('kb_links').insert(cleanLinks.map((l, i) => ({ tutorial_id: id, url: l.url, title: l.title?.trim() || null, sort_order: i })))
        if (ins.error) throw ins.error
      }

      // Anexos removidos
      if (removed.length) {
        setProgress('Removendo anexos…')
        await supabase.storage.from(ATTACHMENTS_BUCKET).remove(removed.map(r => r.storage_path))
        const r = await supabase.from('kb_attachments').delete().in('id', removed.map(r => r.id))
        if (r.error) throw r.error
      }

      // Novos anexos
      for (let i = 0; i < newFiles.length; i++) {
        const { file } = newFiles[i]
        setProgress(`Enviando anexo ${i + 1} de ${newFiles.length}: ${file.name}`)
        const path = `${id}/${crypto.randomUUID()}-${safeFileName(file.name)}`
        const up = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream' })
        if (up.error) throw up.error
        const ins = await supabase.from('kb_attachments').insert({ tutorial_id: id, storage_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size })
        if (ins.error) throw ins.error
      }

      dirty.current = false
      toast.success(status === 'published' ? 'Tutorial publicado! 🎉' : 'Rascunho salvo')
      nav(`/t/${shortCode}`, { replace: true, state: { inApp: true } })
    } catch (e) {
      toast.error(`Erro ao salvar: ${errMsg(e)}`)
    } finally {
      setSaving(null); setProgress('')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => nav(-1)} className="rounded-xl p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-900"><ArrowLeft className="size-5" /></button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{isNew ? 'Novo tutorial' : 'Editar tutorial'}</h1>
            <p className="text-sm text-slate-500">Capriche no título e use o editor para deixar o passo a passo bem claro.</p>
          </div>
        </div>
      </div>

      {/* Informações */}
      <section className="space-y-5 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6 dark:bg-slate-900 dark:ring-slate-800">
        <div>
          <label className={labelCls}>Título *</label>
          <input className={cn(inputCls, 'text-lg font-semibold')} value={title} maxLength={200} placeholder="Ex.: Como configurar a VPN no Windows 11"
            onChange={e => { setTitle(e.target.value); touch() }} autoFocus={isNew} />
        </div>
        <div>
          <label className={labelCls}>Resumo <span className="font-normal text-slate-400">— aparece no card e no topo do tutorial</span></label>
          <textarea className={cn(inputCls, 'resize-none')} rows={2} maxLength={300} value={summary} placeholder="Em uma ou duas frases, o que este tutorial resolve?"
            onChange={e => { setSummary(e.target.value); touch() }} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Categoria</label>
            <select className={inputCls} value={categoryId} onChange={e => { setCategoryId(e.target.value); touch() }}>
              <option value="">Sem categoria</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Nível de dificuldade</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DIFFICULTY) as Difficulty[]).map(k => (
                <button key={k} type="button" onClick={() => { setDifficulty(k); touch() }}
                  className={cn('rounded-xl border px-2 py-2.5 text-sm font-medium transition',
                    difficulty === k ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-4 ring-indigo-500/10 dark:bg-indigo-500/10 dark:text-indigo-300' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400')}>
                  {DIFFICULTY[k].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className={labelCls}>Tags <span className="font-normal text-slate-400">— ajudam na busca (Enter para adicionar)</span></label>
          <div className={cn(inputCls, 'flex flex-wrap items-center gap-1.5 py-2')}>
            <Tag className="size-4 text-slate-400" />
            {tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-sm font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                #{t}<button type="button" onClick={() => { setTags(tags.filter(x => x !== t)); touch() }}><X className="size-3" /></button>
              </span>
            ))}
            <input className="min-w-32 flex-1 bg-transparent outline-none" value={tagInput} placeholder={tags.length ? '' : 'vpn, windows, forticlient…'}
              onChange={e => { if (e.target.value.endsWith(',')) addTag(e.target.value.slice(0, -1)); else setTagInput(e.target.value) }}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) }
                if (e.key === 'Backspace' && !tagInput && tags.length) setTags(tags.slice(0, -1))
              }}
              onBlur={() => tagInput && addTag(tagInput)} />
          </div>
        </div>
      </section>

      {/* Editor */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">Conteúdo</h2>
          <span className="hidden items-center gap-1 text-xs text-slate-400 sm:inline-flex"><Info className="size-3.5" />Cole ou arraste prints direto no texto. Listas numeradas viram passos automaticamente.</span>
        </div>
        <RichEditor
          initialContent={loaded?.content_json ?? (loaded?.content_html || null)}
          userId={profile!.id}
          onChange={(json, html) => {
            if (content.current.json !== null && content.current.html !== html) touch()
            content.current = { json, html }
          }}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Anexos */}
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200"><Paperclip className="size-4" />Anexos</h2>
          <p className="mb-4 text-sm text-slate-500">PDF, Word, PowerPoint, Excel, imagens, scripts, arquivos de configuração… até 50 MB cada.</p>
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
            onClick={() => fileInput.current?.click()}
            className={cn('flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition',
              drag ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50')}>
            <UploadCloud className={cn('size-9', drag ? 'text-indigo-500' : 'text-slate-400')} />
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">Arraste arquivos aqui ou <span className="text-indigo-600">clique para escolher</span></p>
            <input ref={fileInput} type="file" multiple hidden accept={ACCEPT} onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
          </div>
          {(existing.length > 0 || newFiles.length > 0) && (
            <ul className="mt-4 space-y-2">
              {existing.map(a => <FileRow key={a.id} name={a.file_name} mime={a.mime_type} size={a.size_bytes} onRemove={() => { setExisting(existing.filter(x => x.id !== a.id)); setRemoved([...removed, a]); touch() }} />)}
              {newFiles.map(f => <FileRow key={f.key} name={f.file.name} mime={f.file.type} size={f.file.size} isNew onRemove={() => setNewFiles(newFiles.filter(x => x.key !== f.key))} />)}
            </ul>
          )}
        </section>

        {/* Links */}
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200"><Link2 className="size-4" />Links úteis</h2>
          <p className="mb-4 text-sm text-slate-500">Downloads oficiais, documentação, vídeos, portais…</p>
          <div className="space-y-3">
            {links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <div className="flex-1 space-y-1.5">
                  <input className={inputCls} placeholder="https://…" value={l.url} onChange={e => { const n = [...links]; n[i] = { ...l, url: e.target.value }; setLinks(n); touch() }} />
                  <input className={cn(inputCls, 'py-2 text-xs')} placeholder="Descrição (opcional) — ex.: Download do FortiClient" value={l.title ?? ''} onChange={e => { const n = [...links]; n[i] = { ...l, title: e.target.value }; setLinks(n); touch() }} />
                </div>
                <button type="button" onClick={() => { setLinks(links.filter((_, j) => j !== i)); touch() }} className="self-start rounded-lg p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><Trash2 className="size-4" /></button>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setLinks([...links, { url: '', title: '' }])}><Plus className="size-4" />Adicionar link</Button>
          </div>
        </section>
      </div>

      {/* Ações */}
      <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-end gap-3 rounded-2xl bg-white/90 p-3 shadow-xl ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/90 dark:ring-slate-800">
        {progress && <span className="mr-auto truncate pl-2 text-sm text-slate-500">{progress}</span>}
        <Button variant="ghost" onClick={() => nav(-1)} disabled={!!saving}>Cancelar</Button>
        <Button variant="outline" loading={saving === 'draft'} disabled={!!saving} onClick={() => save('draft')}><Save className="size-4" />Salvar rascunho</Button>
        <Button loading={saving === 'published'} disabled={!!saving} onClick={() => save('published')}><Send className="size-4" />{loaded?.status === 'published' ? 'Salvar e publicar' : 'Publicar'}</Button>
      </div>
    </div>
  )
}

function FileRow({ name, mime, size, isNew, onRemove }: { name: string; mime?: string | null; size?: number | null; isNew?: boolean; onRemove: () => void }) {
  const k = fileKind(name, mime)
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg text-white" style={{ background: FILE_STYLE[k].color }}><FileIcon kind={k} className="size-4.5" /></span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{name}</div>
        <div className="text-xs text-slate-400">{FILE_STYLE[k].label} · {fileSize(size)}{isNew && <span className="ml-1.5 font-medium text-emerald-600">novo</span>}</div>
      </div>
      <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><X className="size-4" /></button>
    </li>
  )
}
