import { useEffect, useRef } from 'react'
import { cn } from '../lib/utils'

/**
 * Mascote Android moderno (cabeça em cúpula, mãos soltas, sem cara de robô quadrado).
 * Fica "pendurado" na borda de cima de um cartão: o corpo some atrás da borda e as mãos seguram nela.
 *
 * O movimento é por física, sem re-renderizar o React a cada quadro:
 *  - olhos e cabeça seguem o dedo/mouse com suavização (ou o ponto pedido em `look`)
 *  - as antenas têm mola: balançam quando a cabeça vira e voltam ao lugar
 *  - parado por um tempo, ele olha em volta sozinho
 */
export type MascotMood = 'happy' | 'curious' | 'wink' | 'love' | 'sad' | 'shy' | 'oops'
export type MascotHands = 'grip' | 'cover' | 'peek' | 'wave' | 'hold'
export type MascotAnim = 'rise' | 'jump' | 'shake' | 'giggle' | null

const G = '#3ddc84'
const GD = '#2bbd6e'
const INK = '#06331d'
const TEAR = '#7dd3fc'
const BLUSH = '#ff7aa2'

// posição de cada mão (centro) e escala, em unidades do desenho
const HAND: Record<MascotHands, { l: [number, number, number]; r: [number, number, number] }> = {
  grip: { l: [41, 97, .9], r: [83, 97, .9] },
  cover: { l: [45, 50, 1.3], r: [75, 50, 1.3] },
  peek: { l: [45, 50, 1.3], r: [90, 76, 1.1] },
  wave: { l: [41, 97, .9], r: [109, 48, 1] },
  hold: { l: [41, 97, .9], r: [104, 64, 1] },
}

export default function Mascot({ mood = 'happy', hands = 'grip', anim = null, animKey = 0, look, device, sunk, size = 120, className }: {
  mood?: MascotMood; hands?: MascotHands; anim?: MascotAnim; animKey?: number
  /** ponto para onde olhar (-1…1); sem isso, segue o mouse/dedo */
  look?: { x: number; y: number } | null
  /** o que ele segura na mão direita quando hands = 'hold' */
  device?: 'phone' | 'desktop'
  /** afunda um pouco atrás da borda (desanimado) */
  sunk?: boolean
  size?: number; className?: string
}) {
  const svg = useRef<SVGSVGElement>(null)
  const lookRef = useRef(look)
  lookRef.current = look

  // ---------- laço de animação (olhar + mola das antenas)
  useEffect(() => {
    const el = svg.current
    if (!el) return
    let px: number | null = null, py: number | null = null, lastMove = 0
    let ex = 0, ey = 0, a = 0, av = 0, idleT = 0, idleX = 0, idleY = 0
    let raf = 0
    const onMove = (e: PointerEvent) => { px = e.clientX; py = e.clientY; lastMove = performance.now() }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onMove, { passive: true })
    const clamp = (v: number) => Math.max(-1, Math.min(1, v))
    const tick = (t: number) => {
      let tx = 0, ty = 0
      const want = lookRef.current
      if (want) { tx = want.x; ty = want.y }
      else if (px !== null && py !== null && t - lastMove < 3500) {
        const r = el.getBoundingClientRect()
        tx = clamp((px - (r.left + r.width / 2)) / 260)
        ty = clamp((py - (r.top + r.height * 0.45)) / 260)
      } else {
        // olha em volta sozinho, de vez em quando
        if (t > idleT) { idleT = t + 1800 + Math.random() * 2600; idleX = (Math.random() * 2 - 1) * 0.8; idleY = Math.random() * 0.9 - 0.3 }
        tx = idleX; ty = idleY
      }
      const pex = ex
      ex += (tx - ex) * 0.11
      ey += (ty - ey) * 0.11
      // antenas: mola amortecida empurrada pela velocidade da cabeça
      av += -a * 0.09 - av * 0.16 - (ex - pex) * 55
      a += av
      el.style.setProperty('--ex', ex.toFixed(3))
      el.style.setProperty('--ey', ey.toFixed(3))
      el.style.setProperty('--aw', a.toFixed(2))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerdown', onMove) }
  }, [])

  const h = HAND[hands]
  const droop = mood === 'sad' ? 24 : mood === 'oops' ? 10 : 0
  const animCls = anim === 'rise' ? 'm-rise' : anim === 'jump' ? 'm-jump' : anim === 'shake' ? 'm-shake' : anim === 'giggle' ? 'm-giggle' : ''
  const handAnim = anim === 'jump' || anim === 'giggle' ? animCls : ''
  const eyesOpen = mood === 'happy' || mood === 'curious' || mood === 'sad'
  const eyeRy = mood === 'curious' ? 6.6 : mood === 'sad' ? 4.6 : 5.6
  const eyeY = mood === 'sad' ? 53 : 50
  const showCheeks = mood === 'love' || mood === 'wink' || mood === 'shy' || mood === 'happy'

  const eye = (cx: number) => (
    <g key={cx}>
      <ellipse cx={cx} cy={eyeY} rx="4.6" ry={eyeRy} fill={INK} className="m-ease" />
      <circle cx={cx + 1.5} cy={eyeY - 2} r="1.5" fill="#fff" opacity=".9" />
    </g>
  )
  const heart = (cx: number, cy: number, s = 1) => (
    <path d={`M${cx} ${cy + 4 * s} C${cx - 7 * s} ${cy - 1 * s} ${cx - 4 * s} ${cy - 6.5 * s} ${cx} ${cy - 3 * s} C${cx + 4 * s} ${cy - 6.5 * s} ${cx + 7 * s} ${cy - 1 * s} ${cx} ${cy + 4 * s}Z`} fill="#ff4d7d" />
  )

  return (
    <svg ref={svg} viewBox="0 0 124 104" width={size} height={size * (104 / 124)} aria-hidden className={cn('m-root block overflow-visible', className)}>
      <defs>
        <clipPath id="m-card-edge"><rect x="-40" y="-60" width="204" height="156" /></clipPath>
        <linearGradient id="m-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* cabeça + corpo: somem atrás da borda do cartão */}
      <g clipPath="url(#m-card-edge)">
        <g className="m-sink" style={{ transform: sunk ? 'translateY(9px)' : 'none' }}>
          <g key={`c${animKey}`} className={animCls} style={{ transformBox: 'view-box', transformOrigin: '62px 96px' }}>
            {/* corpo, respirando */}
            <g className="m-breathe" style={{ transformBox: 'view-box', transformOrigin: '62px 104px' }}>
              <rect x="33" y="78" width="58" height="40" rx="17" fill={GD} />
            </g>
            {/* cabeça: vira e inclina na direção do olhar */}
            <g style={{ transformBox: 'view-box', transformOrigin: '62px 74px', transform: 'translate(calc(var(--ex, 0) * 3px), calc(var(--ey, 0) * 1.6px)) rotate(calc(var(--ex, 0) * 5deg))' }}>
              {/* antenas com mola */}
              <g style={{ transformBox: 'view-box', transformOrigin: '41px 31px', transform: `rotate(calc(var(--aw, 0) * 1deg - ${droop}deg))` }} className="m-ease">
                <path d="M41 31 L33.5 16" stroke={G} strokeWidth="5" strokeLinecap="round" />
              </g>
              <g style={{ transformBox: 'view-box', transformOrigin: '83px 31px', transform: `rotate(calc(var(--aw, 0) * 1deg + ${droop}deg))` }} className="m-ease">
                <path d="M83 31 L90.5 16" stroke={G} strokeWidth="5" strokeLinecap="round" />
              </g>
              <path d="M17 68 C17 41 37 22 62 22 C87 22 107 41 107 68 Q107 74 101 74 H23 Q17 74 17 68 Z" fill={G} />
              <path d="M26 52 C28 37 42 27 58 26" stroke="#fff" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" fill="none" />

              {/* rosto: desliza mais que a cabeça, dá a sensação de volume */}
              <g style={{ transform: 'translate(calc(var(--ex, 0) * 6px), calc(var(--ey, 0) * 3.6px))' }}>
                {showCheeks && <>
                  <ellipse cx="33" cy="61" rx="5.5" ry="3.2" fill={BLUSH} opacity={mood === 'shy' || mood === 'love' ? 0.6 : 0.3} />
                  <ellipse cx="91" cy="61" rx="5.5" ry="3.2" fill={BLUSH} opacity={mood === 'shy' || mood === 'love' ? 0.6 : 0.3} />
                </>}
                {eyesOpen && <g className="m-blink" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>{eye(45)}{eye(79)}</g>}
                {mood === 'wink' && <>
                  <path d="M40 51 Q45 45.5 50 51" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
                  {eye(79)}
                </>}
                {mood === 'love' && <g className="m-throb" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>{heart(45, 50, 1.15)}{heart(79, 50, 1.15)}</g>}
                {mood === 'shy' && <>
                  <path d="M40 50 Q45 54 50 50" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
                  <path d="M74 50 Q79 54 84 50" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
                </>}
                {mood === 'oops' && <>
                  <path d="M40 47 L49 51 L40 55" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M84 47 L75 51 L84 55" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </>}
                {mood === 'sad' && <>
                  <path d="M38 43 L50 40" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M86 43 L74 40" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
                  <path className="m-tear" d="M41 58 q-2.4 3.6 0 5.4 q2.4 -1.8 0 -5.4z" fill={TEAR} style={{ transformBox: 'fill-box', transformOrigin: 'top' }} />
                </>}
                {/* boca */}
                {(mood === 'happy' || mood === 'wink') && <path d="M55 61 Q62 67 69 61" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />}
                {mood === 'love' && <path d="M54 60 Q62 70 70 60 Z" fill={INK} />}
                {mood === 'curious' && <ellipse cx="62" cy="63" rx="3" ry="3.4" fill={INK} />}
                {mood === 'shy' && <path d="M57 62 Q62 65 67 62" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />}
                {mood === 'sad' && <path d="M56 65 Q62 60 68 65" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />}
                {mood === 'oops' && <path d="M54 63 q2 -3 4 0 t4 0 t4 0 t4 0" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />}
              </g>
            </g>
          </g>
        </g>
      </g>

      {/* corações subindo quando ele fica feliz de verdade */}
      {mood === 'love' && (
        <g key={`h${animKey}`}>
          <g className="m-float" style={{ animationDelay: '0s' }}>{heart(20, 30, .8)}</g>
          <g className="m-float" style={{ animationDelay: '.35s' }}>{heart(106, 22, .65)}</g>
          <g className="m-float" style={{ animationDelay: '.7s' }}>{heart(62, 8, .55)}</g>
        </g>
      )}

      {/* mãos: na frente do cartão (seguram a borda, tapam os olhos, acenam, mostram o app) */}
      <g key={`m${animKey}`} className={anim === 'rise' ? 'm-hands-in' : handAnim} style={{ transformBox: 'view-box', transformOrigin: '62px 96px' }}>
        <g className="m-spring" style={{ transform: `translate(${h.l[0]}px, ${h.l[1]}px) scale(${h.l[2]})` }}>
          <Paw />
        </g>
        <g className="m-spring" style={{ transform: `translate(${h.r[0]}px, ${h.r[1]}px) scale(${h.r[2]})` }}>
          <g className={hands === 'wave' ? 'm-wave' : hands === 'hold' ? 'm-wiggle' : undefined} style={{ transformBox: 'view-box', transformOrigin: '0px 8px' }}>
            {hands === 'hold' && <Device kind={device ?? 'phone'} />}
            <Paw />
          </g>
        </g>
      </g>
    </svg>
  )
}

/** Mãozinha: um tom mais escuro e com dedinhos, para não sumir na frente da cabeça */
function Paw() {
  return (
    <>
      <ellipse rx="9.5" ry="7.5" fill="#33c677" stroke={INK} strokeOpacity=".3" strokeWidth="1.2" />
      <path d="M-3.2 -6.6 v4.2 M1 -7.2 v4.6 M5 -6.2 v3.8" stroke={INK} strokeOpacity=".28" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M-6 1 q2.5 -2.5 6 -2" stroke="#fff" strokeOpacity=".35" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>
  )
}

/** O que ele mostra na mão: um celular ou um monitor com o ícone do Fields */
function Device({ kind }: { kind: 'phone' | 'desktop' }) {
  const icon = `${import.meta.env.BASE_URL}icons/icon-192.png`
  if (kind === 'desktop') return (
    <g className="m-pop" style={{ transformBox: 'view-box', transformOrigin: '0px 0px' }}>
      <rect x="-17" y="-36" width="34" height="24" rx="3.5" fill="#1c1c1e" />
      <rect x="-14.5" y="-33.5" width="29" height="19" rx="1.8" fill="#eef7f8" />
      <image href={icon} x="-6" y="-30" width="12" height="12" />
      <path d="M-4 -12 h8 l1.5 6 h-11 z" fill="#3a3a3c" />
    </g>
  )
  return (
    <g className="m-pop" style={{ transformBox: 'view-box', transformOrigin: '0px 0px' }}>
      <g transform="rotate(-10)">
        <rect x="-9" y="-40" width="18" height="32" rx="4" fill="#1c1c1e" />
        <rect x="-7.2" y="-37.5" width="14.4" height="27" rx="2.6" fill="#eef7f8" />
        <image href={icon} x="-5" y="-29" width="10" height="10" />
        <rect x="-3" y="-36.6" width="6" height="1.4" rx=".7" fill="#1c1c1e" />
      </g>
    </g>
  )
}
