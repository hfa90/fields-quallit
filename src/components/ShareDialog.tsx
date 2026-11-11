import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Check, Mail, MessageCircle, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from './ui'

export default function ShareDialog({ open, onClose, url, title }: { open: boolean; onClose: () => void; url: string; title: string }) {
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState('')

  useEffect(() => {
    if (!open) return
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#1e1b4b', light: '#ffffff' } }).then(setQr).catch(() => setQr(''))
  }, [open, url])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true); toast.success('Link copiado!')
      setTimeout(() => setCopied(false), 2000)
    } catch { toast.error('Não foi possível copiar. Selecione o link manualmente.') }
  }
  const text = `📘 ${title}`
  const enc = encodeURIComponent

  return (
    <Modal open={open} onClose={onClose} title="Compartilhar tutorial">
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Link curto</label>
          <div className="flex gap-2">
            <input readOnly value={url} onFocus={e => e.target.select()}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
            <button onClick={copy} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Quem abrir o link precisa estar logado na central. A visualização fica registrada.</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <a target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${enc(`${text}\n${url}`)}`}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 p-3 text-xs font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-emerald-500/10">
            <MessageCircle className="size-5 text-emerald-600" />WhatsApp
          </a>
          <a target="_blank" rel="noopener noreferrer" href={`https://teams.microsoft.com/share?href=${enc(url)}&msgText=${enc(text)}`}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 p-3 text-xs font-medium text-slate-700 hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-violet-500/10">
            <Send className="size-5 text-violet-600" />Teams
          </a>
          <a href={`mailto:?subject=${enc(text)}&body=${enc(`${title}\n\n${url}`)}`}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 p-3 text-xs font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-sky-500/10">
            <Mail className="size-5 text-sky-600" />E-mail
          </a>
        </div>

        {qr && (
          <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <img src={qr} alt="QR Code do tutorial" className="size-28 rounded-lg bg-white p-1.5 ring-1 ring-slate-200" />
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <div className="font-semibold text-slate-800 dark:text-slate-200">QR Code</div>
              Aponte a câmera do celular para abrir o tutorial em campo.
              <a href={qr} download={`tutorial-qr.png`} className="mt-2 block text-xs font-semibold text-indigo-600 hover:underline">Baixar QR Code</a>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
