// Service worker: app abre instantâneo e funciona com rede ruim em campo.
// Dados (Supabase) nunca são cacheados aqui — sempre vêm da rede.
const VERSION = 'fq-v5'
const OFFLINE = 'fq-offline-media'
const SHELL = `${VERSION}-shell`
const scope = self.registration.scope

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll([scope, `${scope}manifest.webmanifest`, `${scope}icons/icon-192.png`])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION) && k !== OFFLINE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Mídia e anexos de tutoriais salvos para uso offline
  if (url.pathname.includes('/storage/v1/object/public/') || url.pathname.includes('/__offline__/')) {
    e.respondWith(caches.open(OFFLINE).then(c => c.match(req.url)).then(hit => hit || fetch(req)))
    return
  }
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

// ---------- Notificações push ----------
self.addEventListener('push', e => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { title: 'Fields', body: e.data && e.data.text() } }
  e.waitUntil((async () => {
    if (navigator.setAppBadge && d.badge) { try { await navigator.setAppBadge(d.badge) } catch {} }
    await self.registration.showNotification(d.title || 'Fields', {
      body: d.body || '',
      icon: `${scope}icons/icon-192.png`,
      badge: `${scope}icons/favicon-64.png`,
      tag: d.tag,
      renotify: !!d.tag,
      data: { url: d.url || scope },
    })
  })())
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || scope
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if (c.url.startsWith(scope) && 'focus' in c) { await c.focus(); if ('navigate' in c) await c.navigate(url); return }
    }
    await clients.openWindow(url)
  })())
})
