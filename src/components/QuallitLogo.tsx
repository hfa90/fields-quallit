import { useId } from 'react'

/** Marca Quallit Soluções em TI — "Q" branco com haste laranja sobre fundo teal. */
export const BRAND = { teal: '#1A9CA9', orange: '#FE811E' }

export function QuallitMark({ size = 30, radius = 0.24, bg = true }: { size?: number; radius?: number; bg?: boolean }) {
  const id = `q-cut-${useId().replace(/:/g, '')}`
  return (
    <svg width={size} height={size} viewBox="29 -5.5 160 160" role="img" aria-label="Quallit" className="shrink-0">
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="-10" width="225" height="170">
          <rect x="0" y="-10" width="225" height="170" fill="#fff" />
          <line x1="128" y1="91" x2="200" y2="163" stroke="#000" strokeWidth="46" />
        </mask>
      </defs>
      {bg && <rect x="29" y="-5.5" width="160" height="160" rx={160 * radius} fill={BRAND.teal} />}
      <circle cx="109" cy="74" r="54" fill="none" stroke={bg ? '#fff' : BRAND.teal} strokeWidth="26" mask={`url(#${id})`} />
      <line x1="132" y1="95" x2="162" y2="125" stroke={BRAND.orange} strokeWidth="28" strokeLinecap="round" />
    </svg>
  )
}
