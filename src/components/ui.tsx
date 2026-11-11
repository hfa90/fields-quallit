import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X, Loader2 } from 'lucide-react'
import { CATEGORY_ICONS } from './categoryIcons'
import { avatarColor, cn, initials } from '../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-600/20',
  secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
  outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
}

export function Button({
  variant = 'primary', loading, className, children, size = 'md', ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'sm' | 'md' }) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm',
        VARIANTS[variant], className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Avatar({ name, email, url, size = 32 }: { name?: string | null; email?: string; url?: string | null; size?: number }) {
  if (url) return <img src={url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
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
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-in" onClick={onClose} />
      <div className={cn('relative w-full rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800 max-h-[92vh] overflow-auto pop-in', wide ? 'sm:max-w-4xl' : 'sm:max-w-lg')}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-5 py-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" aria-label="Fechar"><X className="size-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function CategoryIcon({ name, className, style }: { name?: string | null; className?: string; style?: React.CSSProperties }) {
  const Cmp = CATEGORY_ICONS[name || 'folder'] || CATEGORY_ICONS.folder
  return <Cmp className={className} style={style} />
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
      <Loader2 className="size-7 animate-spin text-indigo-500" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 px-6 py-16 text-center">
      <div className="mb-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 p-4 text-indigo-500">{icon}</div>
      <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      {children && <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{children}</div>}
    </div>
  )
}

export const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500'
export const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300'
