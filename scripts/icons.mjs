// Gera os ícones do app (PWA / iOS / Android) a partir de um SVG.
import sharp from 'sharp'

const glyph = (scale) => `
  <g transform="translate(512 512) scale(${scale}) translate(-12 -12)" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 7v14"/>
    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>
  </g>`
const svg = (scale, radius = 0) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c2c2e"/><stop offset="1" stop-color="#1c1c1e"/></linearGradient></defs>
  <rect width="1024" height="1024" rx="${radius}" fill="url(#g)"/>${glyph(scale)}</svg>`)

const out = 'public/icons'
await sharp(svg(22)).resize(180).png().toFile(`${out}/apple-touch-icon.png`)
await sharp(svg(22)).resize(192).png().toFile(`${out}/icon-192.png`)
await sharp(svg(22)).resize(512).png().toFile(`${out}/icon-512.png`)
await sharp(svg(16)).resize(512).png().toFile(`${out}/maskable-512.png`)
await sharp(svg(22, 230)).resize(64).png().toFile(`${out}/favicon-64.png`)
console.log('ícones gerados')
