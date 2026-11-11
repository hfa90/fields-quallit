// Service worker: app abre instantâneo e funciona com rede ruim em campo.
// Dados (Supabase) nunca são cacheados aqui — sempre vêm da rede.
const VERSION = 'fq-v2'
const SHELL = `${VERSION}-shell`
const scope = self.registration.scope

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll([scope, `${scope}manifest.webmanifest`, `${scope}icons/icon-192.png`])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return

  // Navegação: rede primeiro, cai para o app em cache se estiver offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) caches.open(SHELL).then(c => c.put(scope, res.clone()))
      return res
    }).catch(() => caches.match(scope)))
    return
  }

  // Arquivos com hash (assets/) e ícones: cache primeiro
  if (url.pathname.includes('/assets/') || url.pathname.includes('/icons/')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(`${VERSION}-assets`).then(c => c.put(req, copy)) }
      return res
    })))
  }
})
