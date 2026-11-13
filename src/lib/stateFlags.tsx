/**
 * Bandeiras dos estados brasileiros, redesenhadas de forma simplificada
 * (cores e elementos principais) num quadro 100x100 para preencher o
 * contorno do estado. Brasões detalhados foram trocados por formas simples.
 */
import type { ReactNode } from 'react'

const C = {
  green: '#009b3a', yellow: '#fedf00', blue: '#002776', red: '#d52b1e', white: '#ffffff', black: '#111111',
  sky: '#0b5fb0', pink: '#e8a5b9', darkred: '#a8111c',
}

/** estrela de 5 pontas centrada em (cx, cy) */
export function star(cx: number, cy: number, r: number, fill = C.white, rot = -90) {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.42 : r
    const a = ((rot + i * 36) * Math.PI) / 180
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`)
  }
  return <polygon points={pts.join(' ')} fill={fill} />
}

const hStripes = (colors: string[]) => colors.map((c, i) => <rect key={i} x="0" y={(100 / colors.length) * i} width="100" height={100 / colors.length + 0.5} fill={c} />)
const vStripes = (colors: string[]) => colors.map((c, i) => <rect key={i} y="0" x={(100 / colors.length) * i} height="100" width={100 / colors.length + 0.5} fill={c} />)
const bg = (c: string) => <rect width="100" height="100" fill={c} />

export const FLAG: Record<string, () => ReactNode> = {
  AC: () => <><polygon points="0,0 100,0 0,100" fill={C.yellow} /><polygon points="100,0 100,100 0,100" fill={C.green} />{star(22, 22, 11, C.red)}</>,
  AL: () => <>{vStripes([C.red, C.white, C.blue])}<circle cx="50" cy="50" r="12" fill="none" stroke={C.green} strokeWidth="4" />{star(50, 50, 6, C.red)}</>,
  AP: () => <>{bg(C.sky)}<rect y="0" width="100" height="22" fill={C.green} /><rect y="22" width="100" height="4" fill={C.white} /><rect y="78" width="100" height="22" fill={C.green} /><rect y="74" width="100" height="4" fill={C.white} /><rect x="16" y="40" width="20" height="20" fill={C.black} /><rect x="20" y="44" width="12" height="12" fill={C.white} /></>,
  AM: () => <>{hStripes([C.white, C.red, C.white])}<rect width="50" height="50" fill={C.blue} />{star(14, 14, 4)}{star(30, 12, 4)}{star(40, 26, 4)}{star(22, 30, 4)}{star(12, 40, 4)}{star(36, 40, 4)}</>,
  BA: () => <>{hStripes([C.white, C.red, C.white, C.red, C.white])}<rect width="42" height="60" fill={C.blue} /><polygon points="21,14 33,42 9,42" fill={C.white} /></>,
  CE: () => <>{bg(C.green)}<polygon points="50,10 92,50 50,90 8,50" fill={C.yellow} /><circle cx="50" cy="50" r="17" fill={C.white} /><circle cx="50" cy="50" r="9" fill={C.green} /></>,
  DF: () => <>{bg(C.white)}<rect x="22" y="22" width="56" height="56" fill={C.green} /><path d="M50 28 L57 43 L72 50 L57 57 L50 72 L43 57 L28 50 L43 43Z" fill={C.yellow} /><path d="M50 36 L54 46 L64 50 L54 54 L50 64 L46 54 L36 50 L46 46Z" fill={C.green} /></>,
  ES: () => <>{hStripes([C.sky, C.white, C.pink])}<rect x="22" y="45" width="56" height="3" rx="1.5" fill={C.sky} opacity=".55" /><rect x="30" y="51" width="40" height="3" rx="1.5" fill={C.sky} opacity=".55" /></>,
  GO: () => <>{hStripes([C.green, C.yellow, C.green, C.yellow, C.green, C.yellow, C.green, C.yellow])}<rect width="44" height="50" fill={C.blue} />{star(22, 10, 4)}{star(33, 24, 4)}{star(22, 40, 4)}{star(11, 24, 4)}{star(27, 30, 2.6)}</>,
  MA: () => <>{hStripes([C.red, C.white, C.black, C.white, C.red, C.white, C.black, C.white, C.red])}<rect width="40" height="44" fill={C.blue} />{star(20, 22, 10)}</>,
  MT: () => <>{bg(C.blue)}<polygon points="50,8 94,50 50,92 6,50" fill={C.white} /><circle cx="50" cy="50" r="18" fill={C.green} />{star(50, 51, 12, C.yellow)}</>,
  MS: () => <>{bg(C.white)}<polygon points="0,0 100,0 0,58" fill={C.green} /><polygon points="100,26 100,100 22,100" fill={C.blue} />{star(70, 70, 10, C.yellow)}</>,
  MG: () => <>{bg(C.white)}<polygon points="50,18 82,74 18,74" fill={C.red} /><polygon points="50,34 68,66 32,66" fill={C.white} /></>,
  PA: () => <>{bg(C.red)}<polygon points="0,30 0,48 100,70 100,52" fill={C.white} />{star(50, 50, 10, C.blue)}</>,
  PB: () => <>{bg(C.red)}<rect width="34" height="100" fill={C.black} /><text x="67" y="57" textAnchor="middle" fontSize="16" fontWeight="800" fill={C.white} fontFamily="Arial, sans-serif">NEGO</text></>,
  PR: () => <>{bg(C.green)}<polygon points="0,72 0,100 18,100 100,28 100,0 82,0" fill={C.white} /><circle cx="50" cy="50" r="17" fill={C.blue} /><path d="M33 50 Q50 38 67 50" stroke={C.white} strokeWidth="3" fill="none" />{star(44, 57, 3)}{star(54, 59, 3)}{star(50, 51, 2.4)}</>,
  PE: () => <><rect width="100" height="60" fill={C.blue} /><rect y="60" width="100" height="40" fill={C.white} /><path d="M30 44 A20 20 0 0 1 70 44" stroke={C.yellow} strokeWidth="3" fill="none" />{star(50, 28, 10, C.yellow)}<circle cx="50" cy="47" r="5" fill={C.yellow} /><rect x="46" y="66" width="8" height="28" fill={C.red} /><rect x="38" y="72" width="24" height="8" fill={C.red} /></>,
  PI: () => <>{hStripes([C.green, C.yellow, C.green, C.yellow, C.green])}<rect width="36" height="60" fill={C.blue} />{star(18, 30, 10)}</>,
  RJ: () => <><rect width="50" height="50" fill={C.blue} /><rect x="50" width="50" height="50" fill={C.white} /><rect y="50" width="50" height="50" fill={C.white} /><rect x="50" y="50" width="50" height="50" fill={C.blue} /><circle cx="50" cy="50" r="15" fill={C.white} stroke={C.blue} strokeWidth="2" /><path d="M42 54 L50 40 L58 54Z" fill={C.blue} /><rect x="41" y="55" width="18" height="3" fill={C.yellow} /></>,
  RN: () => <><rect width="100" height="50" fill={C.green} /><rect y="50" width="100" height="50" fill={C.white} /><circle cx="50" cy="50" r="14" fill={C.white} stroke={C.yellow} strokeWidth="3" />{star(50, 50, 8, C.green)}</>,
  RS: () => <>{bg(C.yellow)}<polygon points="0,0 100,0 0,100" fill={C.green} /><polygon points="62,0 100,0 100,38 38,100 0,100 0,62" fill={C.red} /><circle cx="50" cy="50" r="14" fill={C.white} /><circle cx="50" cy="50" r="8" fill="none" stroke={C.green} strokeWidth="3" /></>,
  RO: () => <><rect width="100" height="55" fill={C.blue} /><rect y="55" width="100" height="45" fill={C.green} /><polygon points="0,100 50,55 100,100" fill={C.yellow} />{star(50, 30, 13)}</>,
  RR: () => <><rect width="100" height="42" fill={C.sky} /><rect y="42" width="100" height="16" fill={C.white} /><rect y="58" width="100" height="42" fill={C.green} /><rect y="62" width="100" height="4" fill={C.red} />{star(50, 34, 12, C.yellow)}</>,
  SC: () => <>{hStripes([C.red, C.white, C.red])}<polygon points="50,24 76,50 50,76 24,50" fill={C.green} />{star(50, 50, 10, C.white)}</>,
  SP: () => <>{hStripes(Array.from({ length: 13 }, (_, i) => (i % 2 ? C.white : C.black)))}<rect width="46" height="46" fill={C.red} /><circle cx="23" cy="23" r="14" fill={C.white} /><path d="M16 17 Q23 12 30 18 L28 30 Q22 32 17 27Z" fill={C.blue} />{star(10, 8, 2.6)}{star(36, 8, 2.6)}{star(10, 38, 2.6)}{star(36, 38, 2.6)}</>,
  SE: () => <>{hStripes([C.green, C.yellow, C.green, C.yellow])}<rect width="44" height="50" fill={C.blue} />{star(22, 10, 4)}{star(34, 22, 4)}{star(22, 38, 4)}{star(10, 22, 4)}{star(22, 24, 3)}</>,
  TO: () => <>{bg(C.yellow)}<polygon points="0,0 100,0 0,100" fill={C.blue} /><polygon points="72,0 100,0 100,28 28,100 0,100 0,72" fill={C.white} /><circle cx="50" cy="50" r="10" fill={C.yellow} />{Array.from({ length: 12 }, (_, i) => { const a = (i * 30 * Math.PI) / 180; return <line key={i} x1={50 + 12 * Math.cos(a)} y1={50 + 12 * Math.sin(a)} x2={50 + 17 * Math.cos(a)} y2={50 + 17 * Math.sin(a)} stroke={C.yellow} strokeWidth="2.4" strokeLinecap="round" /> })}</>,
}
