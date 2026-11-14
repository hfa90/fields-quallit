import { useEffect, useState } from 'react'
import { qrDataUrl } from '../lib/qr'
import { Copy, Check, Mail, MessageCircle, Users, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from './ui'

export default function ShareDialog({ open, onClose, url, title }: { open: boolean; onClose: () => void; url: string; title: string }) {
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState('')

  useEffect(() => {
    if (!open) return
    qrDataUrl(url, 360).then(setQr).catch(() => setQr(''))
  }, [open, url])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true); toast.success('Link copiado')
      setTimeout(() => setCopied(false), 2000)
    } catch { toast.error('Não foi possível copiar. Selecione o link manualmente.') }
  }
  const enc = encodeURIComponent
  const actions = [
    { label: copied ? 'Copiado' : 'Copiar link', icon: copied ? Check : Copy, color: '#8e8e93', onClick: copy },
    { label: 'WhatsApp', icon: MessageCircle, color: '#25d366', href: `https://wa.me/?text=${enc(`${title}\n${url}`)}` },
    { label: 'Teams', icon: Users, color: '#5b5fc7', href: `https://teams.microsoft.com/share?href=${enc(url)}&msgText=${enc(title)}` },
    { label: 'E-mail', icon: Mail, color: '#007aff', href: `mailto:?subject=${enc(title)}&body=${enc(`${title}\n\n${url}`)}` },
  ]

  return (
    <Modal open={open} onClose={onClose} title="Compartilhar">
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-[12px] bg-neutral-100 p-3 dark:bg-neutral-800">
          {qr && <img src={qr} alt="QR Code do tutorial" className="size-16 shrink-0 rounded-md bg-white p-1" />}
          <div className="min-w-0">
            <div className="line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900 dark:text-white">{title}</div>
            <input readOnly value={url} onFocus={e => e.target.select()} className="mt-0.5 w-full bg-transparent font-mono text-[12px] text-neutral-500 outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {actions.map(a => {
            const inner = (
              <>
                <span className="grid size-14 place-items-center rounded-[14px] text-white" style={{ background: a.color }}><a.icon className="size-6" /></span>
                <span className="text-[12px] text-neutral-700 dark:text-neutral-300">{a.label}</span>
              </>
            )
            const cls = 'press flex flex-col items-center gap-1.5'
            return a.href
              ? <a key={a.label} href={a.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
              : <button key={a.label} onClick={a.onClick} className={cls}>{inner}</button>
          })}
        </div>

        {qr && (
          <a href={qr} download="tutorial-qrcode.png" className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-neutral-100 text-[15px] font-medium text-accent-600 dark:bg-neutral-800 dark:text-accent-400">
            <Download className="size-4" />Salvar QR Code para imprimir
          </a>
        )}
        <p className="text-center text-[12px] text-neutral-500">Quem abrir o link precisa entrar na central. A visualização fica registrada.</p>
      </div>
    </Modal>
  )
}
