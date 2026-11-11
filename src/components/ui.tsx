import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Renderiza no <body>: janelas e camadas fixas não ficam presas a transform/overflow dos pais */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}
import { X, Loader2 } from 'lucide-react'
import { CATEGORY_ICONS } from './categoryIcons'
import { avatarColor, cn, initials } from '../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'tinted'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-600 text-white hover:bg-accent-700 dark:bg-accent-500 dark:hover:bg-accent-400',
  tinted: 'bg-accent-600/10 text-accent-600 hover:bg-accent-600/15 dark:bg-accent-500/15 dark:text-accent-400 dark:hover:bg-accent-500/20',
  secondary: 'bg-neutral-200/70 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700',
  ghost: 'text-neutral-600 hover:bg-neutral-200/60 dark:text-neutral-300 dark:hover:bg-neutral-800',
  danger: 'bg-[#ff3b30] text-white hover:bg-[#e0352b]',
  outline: 'bg-white text-neutral-800 shadow-[0_0_0_0.5px_rgb(0_0_0/0.15),0_1px_2px_rgb(0_0_0/0.05)] hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-100 dark:shadow-[0_0_0_0.5px_rgb(255_255_255/0.15)] dark:hover:bg-neutral-800',
}

export function Button({
  variant = 'primary', loading, className, children, size = 'md', ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'sm' | 'md' }) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={cn(
        'press inline-flex items-center justify-center gap-1.5 rounded-[10px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-[15px]',
        VARIANTS[variant], className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Avatar({ name, email, url, size = 32 }: { name?: string | null; email?: string; url?: string | null; size?: number }) {
  if (url) return <img src={url} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: avatarColor(email || name || '?') }}
      title={name || email}
    >
      {initials(name, email)}
    </span>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/40 animate-in" onClick={onClose} />
      <div className={cn('sheet-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[14px] bg-white shadow-2xl dark:bg-neutral-900 sm:rounded-[14px]', wide ? 'sm:max-w-4xl' : 'sm:max-w-md')}>
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-neutral-300 sm:hidden dark:bg-neutral-700" />
        <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-3 sm:pt-4">
          <h3 className="truncate text-[17px] font-semibold text-neutral-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="grid size-7 shrink-0 place-items-center rounded-full bg-neutral-200/70 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400" aria-label="Fechar"><X className="size-4" strokeWidth={2.5} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  , document.body)
}

export function CategoryIcon({ name, className, style }: { name?: string | null; className?: string; style?: React.CSSProperties }) {
  const Cmp = CATEGORY_ICONS[name || 'folder'] || CATEGORY_ICONS.folder
  return <Cmp className={className} style={style} />
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-neutral-500">
      <Loader2 className="size-6 animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 text-neutral-300 dark:text-neutral-600">{icon}</div>
      <h3 className="text-[17px] font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
      {children && <div className="mt-1 max-w-sm text-[15px] text-neutral-500">{children}</div>}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-end justify-between px-1">
      <h2 className="text-[13px] font-medium uppercase tracking-wide text-neutral-500">{children}</h2>
      {action}
    </div>
  )
}

export const inputCls = 'w-full rounded-[10px] bg-white px-3.5 h-11 text-[15px] text-neutral-900 placeholder:text-neutral-400 outline-none transition shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)] focus:shadow-[0_0_0_2px_var(--color-accent-500)] dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500 dark:shadow-[0_0_0_0.5px_rgb(255_255_255/0.15)]'
export const textareaCls = inputCls.replace('h-11', 'py-2.5')
export const labelCls = 'mb-1.5 block text-[13px] font-medium text-neutral-600 dark:text-neutral-400'
