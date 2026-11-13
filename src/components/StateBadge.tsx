import { useId } from 'react'
import { MapPin } from 'lucide-react'
import { UF_BOX, UF_NAME, UF_SHAPE } from '../lib/brStates'
import { FLAG } from '../lib/stateFlags'
import { cn } from '../lib/utils'

/** Contorno do estado preenchido com a bandeira dele */
export default function StateBadge({ uf, size = 64, className }: { uf?: string | null; size?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  const key = uf?.toUpperCase() ?? ''
  const shape = UF_SHAPE[key]
  if (!shape) {
    return (
      <span className={cn('grid place-items-center rounded-2xl border border-dashed border-neutral-300 text-neutral-400 dark:border-neutral-700', className)}
        style={{ width: size * 0.8, height: size * 0.8 }} title="CD não informado">
        <MapPin className="size-1/3" />
      </span>
    )
  }
  const [x, y, w, h] = UF_BOX[key]
  const flag = FLAG[key]
  return (
    <svg viewBox="-3 -3 106 106" width={size} height={size} role="img" aria-label={`Bandeira de ${UF_NAME[key]}`}
      className={cn('shrink-0 overflow-visible [filter:drop-shadow(0_3px_5px_rgb(0_0_0/0.22))]', className)}>
      <defs>
        <clipPath id={`c${id}`}><path d={shape} /></clipPath>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".38" />
          <stop offset=".45" stopColor="#fff" stopOpacity=".05" />
          <stop offset="1" stopColor="#000" stopOpacity=".14" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#c${id})`}>
        <g transform={`translate(${x} ${y}) scale(${w / 100} ${h / 100})`}>{flag ? flag() : <rect width="100" height="100" fill="#1a9ca9" />}</g>
        <rect width="100" height="100" fill={`url(#g${id})`} />
      </g>
      <path d={shape} fill="none" stroke="#0b2a33" strokeOpacity=".35" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  )
}
