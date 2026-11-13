import { cn } from '../lib/utils'

export type DroidMood = 'happy' | 'sad' | 'desperate' | 'calm' | 'wink' | 'cry'

const G = '#3ddc84'      // verde do Android
const GD = '#2fbf6f'     // sombra
const INK = '#14532d'    // boca / pupilas
const TEAR = '#7dd3fc'

/**
 * Robozinho Android desenhado em SVG, com expressões e animações.
 * - mood: expressão do rosto
 * - look: para onde os olhos olham (-1 esquerda … 1 direita) e lookY (-1 cima … 1 baixo)
 * - wave: acena com o braço direito · shake: treme (desespero) · headOnly: só a cabeça
 * - gait: 'walk' (andando devagar) ou 'run' (correndo); lean: inclinação do corpo (graus)
 */
export default function Droid({ mood = 'happy', look = 0, lookY = 0, wave, shake, headOnly, size = 120, tilt = 0, gait, lean = 0, className }: {
  mood?: DroidMood; look?: number; lookY?: number; wave?: boolean; shake?: boolean; headOnly?: boolean; size?: number; tilt?: number
  gait?: 'walk' | 'run'; lean?: number; className?: string
}) {
  const fx = Math.max(-1, Math.min(1, look)) * 5
  const fy = Math.max(-1, Math.min(1, lookY)) * 3
  const box = { transformBox: 'fill-box' as const }
  const vb = headOnly ? '6 -2 108 66' : '0 0 120 150'
  const w = size, h = headOnly ? size * (66 / 108) : size * (150 / 120)

  const face = (
    <g style={{ transform: `translate(${fx}px, ${fy}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)' }}>
      {mood === 'happy' && <>
        <g className="droid-blink" style={{ ...box, transformOrigin: 'center' }}><circle cx="45" cy="40" r="4.6" fill="#fff" /><circle cx="75" cy="40" r="4.6" fill="#fff" /></g>
        <path d="M50 49 Q60 56 70 49" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
      </>}
      {mood === 'wink' && <>
        <path d="M40 41 Q45 36 50 41" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="75" cy="40" r="4.6" fill="#fff" />
        <path d="M48 48 Q60 58 72 48" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="38" cy="50" r="3.5" fill="#ff8fab" opacity=".55" /><circle cx="82" cy="50" r="3.5" fill="#ff8fab" opacity=".55" />
      </>}
      {mood === 'sad' && <>
        <path d="M37 34 L50 30" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /><path d="M83 34 L70 30" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="45" cy="42" r="4" fill="#fff" /><circle cx="75" cy="42" r="4" fill="#fff" />
        <path d="M51 54 Q60 47 69 54" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path className="droid-tear" d="M41 47 q-2.2 3.4 0 5 q2.2 -1.6 0 -5z" fill={TEAR} style={{ ...box, transformOrigin: 'top' }} />
      </>}
      {mood === 'desperate' && <>
        <path d="M36 28 L50 33" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /><path d="M84 28 L70 33" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="45" cy="41" r="7" fill="#fff" /><circle cx="75" cy="41" r="7" fill="#fff" />
        <circle className="droid-jitter" cx="45" cy="41" r="2.6" fill={INK} /><circle className="droid-jitter" cx="75" cy="41" r="2.6" fill={INK} />
        <ellipse cx="60" cy="53" rx="6" ry="4.6" fill={INK} />
      </>}
      {mood === 'cry' && <>
        <path d="M39 38 L50 42 L39 45" stroke="#fff" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M81 38 L70 42 L81 45" stroke="#fff" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M52 55 Q60 46 68 55 Z" fill={INK} />
        <path className="droid-tear" d="M43 46 q-2.4 3.6 0 5.4 q2.4 -1.8 0 -5.4z" fill={TEAR} style={{ ...box, transformOrigin: 'top' }} />
        <path className="droid-tear droid-tear-2" d="M77 46 q-2.4 3.6 0 5.4 q2.4 -1.8 0 -5.4z" fill={TEAR} style={{ ...box, transformOrigin: 'top' }} />
      </>}
      {mood === 'calm' && <>
        <path d="M40 40 Q45 44 50 40" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M70 40 Q75 44 80 40" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M53 50 Q60 54 67 50" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      </>}
    </g>
  )

  return (
    <svg viewBox={vb} width={w} height={h} aria-hidden className={cn('overflow-visible', className)}>
      <g style={{ ...box, transformOrigin: '50% 100%', transform: `rotate(${lean}deg)`, transition: 'transform .3s ease-out' }}>
      <g className={cn(shake ? 'droid-shake' : gait === 'run' ? 'droid-step droid-step-run' : gait === 'walk' ? 'droid-step' : 'droid-bob')} style={{ ...box, transformOrigin: 'bottom' }}>
        {!headOnly && <>
          {/* braços (balançam ao andar) */}
          <g className={gait ? cn('droid-swing', gait === 'run' && 'droid-swing-run') : undefined} style={{ ...box, transformOrigin: '50% 10%' }}>
            <rect x="4" y="66" width="12" height="40" rx="6" fill={G} />
          </g>
          <g className={gait ? cn('droid-swing droid-swing-alt', gait === 'run' && 'droid-swing-run') : wave ? 'droid-wave' : undefined} style={{ ...box, transformOrigin: '50% 10%' }}>
            <rect x="104" y="66" width="12" height="40" rx="6" fill={G} />
          </g>
          {/* corpo e pernas (alternam ao andar) */}
          <g className={gait ? cn('droid-leg', gait === 'run' && 'droid-leg-run') : undefined} style={{ ...box, transformOrigin: '50% 0%' }}>
            <rect x="38" y="112" width="14" height="30" rx="7" fill={GD} />
          </g>
          <g className={gait ? cn('droid-leg droid-leg-alt', gait === 'run' && 'droid-leg-run') : undefined} style={{ ...box, transformOrigin: '50% 0%' }}>
            <rect x="68" y="112" width="14" height="30" rx="7" fill={GD} />
          </g>
          <path d="M20 64 H100 V110 a14 14 0 0 1 -14 14 H34 a14 14 0 0 1 -14 -14 Z" fill={G} />
        </>}
        {/* cabeça */}
        <g style={{ ...box, transformOrigin: '50% 100%', transform: `rotate(${tilt}deg)`, transition: 'transform .4s cubic-bezier(.2,.8,.2,1)' }}>
          <g className="droid-antenna" style={{ ...box, transformOrigin: '100% 100%' }}><line x1="41" y1="24" x2="33" y2="9" stroke={G} strokeWidth="4.5" strokeLinecap="round" /></g>
          <g className="droid-antenna droid-antenna-r" style={{ ...box, transformOrigin: '0% 100%' }}><line x1="79" y1="24" x2="87" y2="9" stroke={G} strokeWidth="4.5" strokeLinecap="round" /></g>
          <path d="M20 60 A40 40 0 0 1 100 60 Z" fill={G} />
          {face}
          {mood === 'desperate' && <>
            <path className="droid-sweat" d="M100 22 q-3 5 0 7 q3 -2 0 -7z" fill={TEAR} />
            <path className="droid-sweat droid-sweat-2" d="M18 30 q-2.5 4 0 6 q2.5 -2 0 -6z" fill={TEAR} />
          </>}
        </g>
      </g>
      </g>
    </svg>
  )
}
