import { useNavigate } from 'react-router-dom'
import { Bell, MessageSquare, AlertTriangle, ThumbsDown, FilePlus2, RefreshCw, HandHelping, CheckCircle2, Reply, X } from 'lucide-react'
import { useNotifications } from '../lib/notifications'
import { cn, timeAgo } from '../lib/utils'

const ICON: Record<string, { icon: typeof Bell; color: string }> = {
  new_tutorial: { icon: FilePlus2, color: '#1a9ca9' },
  updated: { icon: RefreshCw, color: '#1a9ca9' },
  comment_comment: { icon: MessageSquare, color: '#8e8e93' },
  comment_question: { icon: MessageSquare, color: '#af52de' },
  comment_tip: { icon: MessageSquare, color: '#34c759' },
  comment_outdated: { icon: AlertTriangle, color: '#fe811e' },
  not_helpful: { icon: ThumbsDown, color: '#ff3b30' },
  new_request: { icon: HandHelping, color: '#fe811e' },
  request_comment: { icon: MessageSquare, color: '#fe811e' },
  request_answered: { icon: CheckCircle2, color: '#34c759' },
  reply: { icon: Reply, color: '#8e8e93' },
  verified: { icon: CheckCircle2, color: '#1a9ca9' },
  review_due: { icon: RefreshCw, color: '#fe811e' },
  new_trail: { icon: FilePlus2, color: '#1a9ca9' },
}

export default function NotificationList({ onNavigate, compact }: { onNavigate?: () => void; compact?: boolean }) {
  const { items, loading, markRead, remove } = useNotifications()
  const nav = useNavigate()
  const list = compact ? items.slice(0, 8) : items

  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <Bell className="size-10 text-neutral-300 dark:text-neutral-600" strokeWidth={1.4} />
        <p className="mt-3 text-[15px] font-medium text-neutral-800 dark:text-neutral-200">Tudo em dia</p>
        <p className="mt-1 text-[13px] text-neutral-500">Siga categorias e colegas para saber quando sai algo novo.</p>
      </div>
    )
  }
  return (
    <ul className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
      {list.map(n => {
        const meta = ICON[n.type] ?? { icon: Bell, color: '#8e8e93' }
        return (
          <li key={n.id} className="group relative">
            <button
              onClick={() => { markRead(n.id); if (n.link) nav(n.link.split('#')[0], { state: { inApp: true, hash: n.link.split('#')[1] } }); onNavigate?.() }}
              className={cn('flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-900/[.03] dark:hover:bg-white/[.04]', !n.read_at && 'bg-accent-500/[.05]')}>
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full" style={{ background: `${meta.color}1a`, color: meta.color }}>
                <meta.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 pr-5">
                <span className={cn('block text-[14px] leading-snug text-neutral-900 dark:text-neutral-100', !n.read_at && 'font-semibold')}>{n.title}</span>
                {n.body && <span className="mt-0.5 block text-[13px] text-neutral-500 line-clamp-2">{n.body}</span>}
                <span className="mt-1 block text-[12px] text-neutral-400">{timeAgo(n.created_at)}</span>
              </span>
              {!n.read_at && <span className="absolute right-4 top-4 size-2 rounded-full bg-accent-500" />}
            </button>
            <button onClick={() => remove(n.id)} aria-label="Remover"
              className="absolute bottom-2.5 right-3 rounded-full p-1 text-neutral-400 opacity-0 transition hover:bg-neutral-900/5 group-hover:opacity-100">
              <X className="size-3.5" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
