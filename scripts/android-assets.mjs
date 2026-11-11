// Gera as imagens de origem do ícone/abertura do app Android (usadas pelo @capacitor/assets).
import sharp from 'sharp'

const q = (stroke = '#fff') => `
  <defs><mask id="c" maskUnits="userSpaceOnUse" x="-500" y="-500" width="1500" height="1500">
    <rect x="-500" y="-500" width="1500" height="1500" fill="#fff"/>
    <line x1="128" y1="91" x2="260" y2="223" stroke="#000" stroke-width="46"/></mask></defs>
  <circle cx="109" cy="74" r="54" fill="none" stroke="${stroke}" stroke-width="26" mask="url(#c)"/>
  <line x1="132" y1="95" x2="162" y2="125" stroke="#FE811E" stroke-width="28" stroke-linecap="round"/>`
// pad maior = Q menor dentro do quadro
const svg = (pad, bg) => {
  const size = 160 + pad * 2, x = 29 - pad, y = -5.5 - pad
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${size} ${size}" width="1024" height="1024">
    ${bg ? `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${bg}"/>` : ''}${q()}</svg>`)
}
const solid = (color, w = 1024, h = 1024) => sharp({ create: { width: w, height: h, channels: 4, background: color } })

await sharp(svg(28, '#1A9CA9')).png().toFile('assets/icon-only.png')
await sharp(svg(95)).png().toFile('assets/icon-foreground.png')        // zona segura do ícone adaptativo
await solid('#1A9CA9').png().toFile('assets/icon-background.png')
// abertura: Q centralizado no teal
const splashQ = await sharp(svg(40)).resize(700).png().toBuffer()
await solid('#1A9CA9', 2732, 2732).composite([{ input: splashQ, gravity: 'center' }]).png().toFile('assets/splash.png')
await solid('#0d4f56', 2732, 2732).composite([{ input: splashQ, gravity: 'center' }]).png().toFile('assets/splash-dark.png')
console.log('assets gerados')
