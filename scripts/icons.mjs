// Gera os ícones do app (PWA / iOS / Android) com a marca Quallit.
import sharp from 'sharp'

// pad = espaço em volta do "Q" (maior para ícones "maskable" do Android)
const svg = (pad, radius = 0) => {
  const size = 160 + pad * 2, x = 29 - pad, y = -5.5 - pad
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${size} ${size}" width="1024" height="1024">
  <defs><mask id="c" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${size}" height="${size}">
    <rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#fff"/>
    <line x1="128" y1="91" x2="240" y2="203" stroke="#000" stroke-width="46"/></mask></defs>
  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * radius}" fill="#1A9CA9"/>
  <circle cx="109" cy="74" r="54" fill="none" stroke="#fff" stroke-width="26" mask="url(#c)"/>
  <line x1="132" y1="95" x2="162" y2="125" stroke="#FE811E" stroke-width="28" stroke-linecap="round"/>
</svg>`)
}

const out = 'public/icons'
await sharp(svg(28)).resize(180).png().toFile(`${out}/apple-touch-icon.png`)
await sharp(svg(28)).resize(192).png().toFile(`${out}/icon-192.png`)
await sharp(svg(28)).resize(512).png().toFile(`${out}/icon-512.png`)
await sharp(svg(70)).resize(512).png().toFile(`${out}/maskable-512.png`)
await sharp(svg(14, 0.22)).resize(64).png().toFile(`${out}/favicon-64.png`)
console.log('ícones gerados')
