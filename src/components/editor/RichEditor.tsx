import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import {
  Bold, Italic, Underline, Strikethrough, Code, Highlighter, List, ListOrdered, ListChecks, Quote, SquareCode,
  Minus, Link2, ImagePlus, Camera, Video as VideoIcon, PenTool, SquarePlay as YoutubeIcon, Table as TableIcon, Undo2, Redo2, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, Eraser, LayoutTemplate, Palette, MessageSquareWarning, Rows3, Columns3, Trash2, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { buildExtensions, CALLOUTS, type CalloutType } from './extensions'
import { TEMPLATES } from './templates'
import { uploadImage, uploadVideo } from '../../lib/upload'

const Annotator = lazy(() => import('./Annotator'))
import { cn, errMsg } from '../../lib/utils'
import { Button, Modal, inputCls } from '../ui'

const LANGS = ['plaintext', 'bash', 'powershell', 'shell', 'javascript', 'typescript', 'python', 'json', 'yaml', 'xml', 'sql', 'ini', 'dos', 'csharp', 'java', 'php', 'css']
const COLORS = ['#0f172a', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#64748b']
const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#bae6fd', '#fbcfe8', '#fed7aa', '#ddd6fe']

interface Props {
  initialContent: unknown
  userId: string
  onChange: (json: unknown, html: string) => void
}

export default function RichEditor({ initialContent, userId, onChange }: Props) {
  const [uploading, setUploading] = useState(0)
  const [annot, setAnnot] = useState<File | string | null>(null)

  const handleVideo = async (file?: File) => {
    if (!file) return
    setUploading(n => n + 1)
    const t = toast.loading('Enviando vídeo…')
    try {
      const src = await uploadVideo(file, userId)
      editorRef.current?.chain().focus().insertContent({ type: 'video', attrs: { src } }).run()
      toast.success('Vídeo inserido', { id: t })
    } catch (e) { toast.error(errMsg(e), { id: t }) } finally { setUploading(n => n - 1) }
  }
  const editorRef = useRef<Editor | null>(null)

  const handleFiles = async (files: File[], pos?: number) => {
    const imgs = files.filter(f => f.type.startsWith('image/'))
    if (!imgs.length) return false
    for (const f of imgs) {
      setUploading(n => n + 1)
      try {
        const src = await uploadImage(f, userId)
        const ed = editorRef.current
        if (!ed) continue
        const chain = ed.chain().focus()
        if (pos != null) chain.insertContentAt(pos, { type: 'image', attrs: { src, alt: f.name } }).run()
        else chain.setImage({ src, alt: f.name }).run()
      } catch (e) {
        toast.error(`Falha ao enviar imagem: ${errMsg(e)}`)
      } finally {
        setUploading(n => n - 1)
      }
    }
    return true
  }

  const editor = useEditor({
    extensions: buildExtensions(),
    content: (initialContent as object) ?? '',
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: 'tutorial-content prose-editor min-h-[420px] px-5 py-6 sm:px-8 outline-none' },
      handlePaste: (_v, e) => {
        const files = Array.from(e.clipboardData?.files ?? [])
        if (files.some(f => f.type.startsWith('image/'))) { e.preventDefault(); handleFiles(files); return true }
        return false
      },
      handleDrop: (view, e) => {
        const files = Array.from((e as DragEvent).dataTransfer?.files ?? [])
        if (!files.some(f => f.type.startsWith('image/'))) return false
        e.preventDefault()
        const coords = view.posAtCoords({ left: (e as DragEvent).clientX, top: (e as DragEvent).clientY })
        handleFiles(files, coords?.pos)
        return true
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON(), editor.getHTML()),
    onCreate: ({ editor }) => onChange(editor.getJSON(), editor.getHTML()),
  })

  useEffect(() => { editorRef.current = editor }, [editor])

  if (!editor) return null
  return (
    <div className="card">
      <Toolbar editor={editor} onImages={files => handleFiles(files)} uploading={uploading > 0}
        onAnnotate={src => setAnnot(src)} onVideo={handleVideo} />
      {annot && (
        <Suspense fallback={null}>
          <Annotator source={annot} onCancel={() => setAnnot(null)} onDone={async file => {
            const src = await uploadImage(file, userId)
            const ed = editorRef.current!
            if (typeof annot === 'string' && ed.isActive('image')) ed.chain().focus().updateAttributes('image', { src }).run()
            else ed.chain().focus().setImage({ src, alt: 'Foto' }).run()
            setAnnot(null)
            toast.success('Imagem inserida')
          }} />
        </Suspense>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}

function TB({ active, onClick, title, children, disabled }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      onMouseDown={e => e.preventDefault()}
      className={cn('inline-flex size-8 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white',
        active && 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300')}
    >{children}</button>
  )
}
const Sep = () => <span className="mx-1 h-6 w-px bg-neutral-200 dark:bg-neutral-700" />

function Popover({ icon, title, children, active }: { icon: React.ReactNode; title: string; children: (close: () => void) => React.ReactNode; active?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', h, true)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', h, true); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <TB title={title} active={active || open} onClick={() => setOpen(o => !o)}>{icon}</TB>
      {open && (
        <div className="absolute left-0 top-10 z-30 min-w-52 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 pop-in">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

function Toolbar({ editor, onImages, uploading, onAnnotate, onVideo }: { editor: Editor; onImages: (f: File[]) => void; uploading: boolean; onAnnotate: (src: File | string) => void; onVideo: (f?: File) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const vidRef = useRef<HTMLInputElement>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [ytOpen, setYtOpen] = useState(false)
  const [tplOpen, setTplOpen] = useState(false)
  const [url, setUrl] = useState('')

  const block = editor.isActive('heading', { level: 1 }) ? 'h1'
    : editor.isActive('heading', { level: 2 }) ? 'h2'
    : editor.isActive('heading', { level: 3 }) ? 'h3'
    : editor.isActive('heading', { level: 4 }) ? 'h4' : 'p'

  const setBlock = (v: string) => {
    const c = editor.chain().focus()
    if (v === 'p') c.setParagraph().run()
    else c.toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 | 4 }).run()
  }

  const openLink = () => { setUrl(editor.getAttributes('link').href ?? ''); setLinkOpen(true) }
  const applyLink = () => {
    const u = url.trim()
    if (!u) editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else {
      const href = /^https?:\/\//i.test(u) || u.startsWith('mailto:') ? u : `https://${u}`
      if (editor.state.selection.empty && !editor.isActive('link'))
        editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run()
      else editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
    setLinkOpen(false)
  }

  const inTable = editor.isActive('table')
  const inCode = editor.isActive('codeBlock')
  const inImage = editor.isActive('image')

  return (
    <div className="material hairline-b sticky top-[calc(56px+env(safe-area-inset-top))] z-20 rounded-t-2xl">
      <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto px-2 py-1.5 sm:flex-wrap sm:overflow-visible">
        <TB title="Desfazer (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo2 className="size-4" /></TB>
        <TB title="Refazer (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo2 className="size-4" /></TB>
        <Sep />
        <select
          value={block} onChange={e => setBlock(e.target.value)} title="Estilo do texto"
          className="h-8 rounded-lg border-0 bg-transparent px-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 focus:ring-2 focus:ring-accent-500/30 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:bg-neutral-900"
        >
          <option value="p">Texto normal</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2 (seção)</option>
          <option value="h3">Título 3</option>
          <option value="h4">Título 4</option>
        </select>
        <Sep />
        <TB title="Negrito (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="size-4" /></TB>
        <TB title="Itálico (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="size-4" /></TB>
        <TB title="Sublinhado (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline className="size-4" /></TB>
        <TB title="Tachado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="size-4" /></TB>
        <TB title="Código inline" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="size-4" /></TB>
        <Popover title="Marca-texto" icon={<Highlighter className="size-4" />} active={editor.isActive('highlight')}>
          {close => (
            <div className="flex items-center gap-1.5 p-1">
              {HIGHLIGHTS.map(c => (
                <button key={c} type="button" className="size-7 rounded-md ring-1 ring-black/10" style={{ background: c }}
                  onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); close() }} />
              ))}
              <button type="button" className="ml-1 rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                onClick={() => { editor.chain().focus().unsetHighlight().run(); close() }}>Remover</button>
            </div>
          )}
        </Popover>
        <Popover title="Cor do texto" icon={<Palette className="size-4" />}>
          {close => (
            <div className="grid grid-cols-5 gap-1.5 p-1">
              {COLORS.map(c => (
                <button key={c} type="button" className="size-7 rounded-md ring-1 ring-black/10" style={{ background: c }}
                  onClick={() => { editor.chain().focus().setColor(c).run(); close() }} />
              ))}
              <button type="button" className="col-span-5 mt-1 rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                onClick={() => { editor.chain().focus().unsetColor().run(); close() }}>Cor padrão</button>
            </div>
          )}
        </Popover>
        <Sep />
        <TB title="Alinhar à esquerda" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="size-4" /></TB>
        <TB title="Centralizar" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="size-4" /></TB>
        <TB title="Alinhar à direita" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="size-4" /></TB>
        <TB title="Justificar" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="size-4" /></TB>
        <Sep />
        <TB title="Lista com marcadores" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="size-4" /></TB>
        <TB title="Passos numerados" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="size-4" /></TB>
        <TB title="Checklist" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks className="size-4" /></TB>
        <Sep />
        <TB title="Citação" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="size-4" /></TB>
        <TB title="Bloco de código / comando" active={inCode} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><SquareCode className="size-4" /></TB>
        <Popover title="Caixa de destaque" icon={<MessageSquareWarning className="size-4" />} active={editor.isActive('callout')}>
          {close => (
            <div className="flex flex-col">
              {(Object.keys(CALLOUTS) as CalloutType[]).map(t => (
                <button key={t} type="button"
                  className={cn('callout-pick flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800', `pick-${t}`)}
                  onClick={() => { editor.chain().focus().toggleCallout(t).run(); close() }}>
                  <span className="size-2.5 rounded-full" style={{ background: CALLOUTS[t].color }} /><span className="font-medium">{CALLOUTS[t].label}</span>
                </button>
              ))}
            </div>
          )}
        </Popover>
        <TB title="Linha divisória" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="size-4" /></TB>
        <Sep />
        <TB title="Link" active={editor.isActive('link')} onClick={openLink}><Link2 className="size-4" /></TB>
        <TB title="Inserir imagem (ou cole / arraste no texto)" onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        </TB>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { onImages(Array.from(e.target.files ?? [])); e.target.value = '' }} />
        <TB title="Tirar foto e marcar (câmera)" onClick={() => camRef.current?.click()}><Camera className="size-4" /></TB>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onAnnotate(f); e.target.value = '' }} />
        <TB title="Gravar ou enviar vídeo curto (até 50 MB)" onClick={() => vidRef.current?.click()}><VideoIcon className="size-4" /></TB>
        <input ref={vidRef} type="file" accept="video/*" capture="environment" hidden onChange={e => { onVideo(e.target.files?.[0]); e.target.value = '' }} />
        <TB title="Vídeo do YouTube" onClick={() => { setUrl(''); setYtOpen(true) }}><YoutubeIcon className="size-4" /></TB>
        <TB title="Inserir tabela" active={inTable} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="size-4" /></TB>
        <Sep />
        <TB title="Limpar formatação" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><Eraser className="size-4" /></TB>
        <button type="button" onClick={() => setTplOpen(true)}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent-600/10 px-3 text-[13px] font-medium text-accent-600 hover:bg-accent-600/15 dark:bg-accent-500/15 dark:text-accent-400">
          <LayoutTemplate className="size-3.5" /> Usar modelo
        </button>
      </div>

      {(inTable || inCode || inImage) && (
        <div className="flex flex-wrap items-center gap-1 border-t border-neutral-100 px-3 py-1.5 text-xs dark:border-neutral-800">
          {inImage && <>
            <span className="mr-1 font-medium text-neutral-500">Imagem:</span>
            <Button size="sm" variant="tinted" type="button" onClick={() => onAnnotate(editor.getAttributes('image').src)}><PenTool className="size-3.5" />Marcar com setas e círculos</Button>
          </>}
          {inTable && <>
            <span className="mr-1 font-medium text-neutral-500">Tabela:</span>
            <Button size="sm" variant="ghost" type="button" onClick={() => editor.chain().focus().addRowAfter().run()}><Rows3 className="size-3.5" />+ Linha</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}><Columns3 className="size-3.5" />+ Coluna</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => editor.chain().focus().deleteRow().run()}>− Linha</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>− Coluna</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Cabeçalho</Button>
            <Button size="sm" variant="ghost" type="button" className="text-[#ff3b30]" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 className="size-3.5" />Excluir tabela</Button>
          </>}
          {inCode && <>
            <span className="mr-1 font-medium text-neutral-500">Linguagem:</span>
            <select
              className="h-7 rounded-md border border-neutral-200 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              value={editor.getAttributes('codeBlock').language ?? 'plaintext'}
              onChange={e => editor.chain().focus().updateAttributes('codeBlock', { language: e.target.value }).run()}
            >{LANGS.map(l => <option key={l} value={l}>{l}</option>)}</select>
          </>}
        </div>
      )}

      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Inserir link">
        <form onSubmit={e => { e.preventDefault(); applyLink() }} className="space-y-4">
          <input autoFocus className={inputCls} placeholder="https://exemplo.com" value={url} onChange={e => setUrl(e.target.value)} />
          <div className="flex justify-end gap-2">
            {editor.isActive('link') && <Button type="button" variant="ghost" onClick={() => { setUrl(''); editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLinkOpen(false) }}>Remover link</Button>}
            <Button type="submit">Aplicar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={ytOpen} onClose={() => setYtOpen(false)} title="Inserir vídeo do YouTube">
        <form onSubmit={e => {
          e.preventDefault()
          if (!editor.commands.setYoutubeVideo({ src: url.trim() })) toast.error('URL do YouTube inválida')
          else setYtOpen(false)
        }} className="space-y-4">
          <input autoFocus className={inputCls} placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={e => setUrl(e.target.value)} />
          <div className="flex justify-end"><Button type="submit">Inserir vídeo</Button></div>
        </form>
      </Modal>

      <Modal open={tplOpen} onClose={() => setTplOpen(false)} title="Escolha um modelo de tutorial">
        <p className="mb-4 text-sm text-neutral-500">O modelo é inserido na posição do cursor. Depois é só substituir os textos de exemplo.</p>
        <div className="grid gap-3">
          {TEMPLATES.map(t => (
            <button key={t.id} type="button"
              onClick={() => {
                if (editor.isEmpty) editor.commands.setContent(t.html, { emitUpdate: true })
                else editor.chain().focus().insertContent(t.html).run()
                setTplOpen(false)
              }}
              className="group rounded-xl border border-neutral-200 p-4 text-left transition hover:border-accent-400 hover:bg-accent-50/50 dark:border-neutral-700 dark:hover:bg-accent-500/5">
              <div className="font-semibold text-neutral-800 group-hover:text-accent-600 dark:text-neutral-100">{t.name}</div>
              <div className="text-sm text-neutral-500">{t.description}</div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
