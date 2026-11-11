import { supabase } from './supabase'

const FN = 'https://wrmlmtxkukjxkivtsuex.supabase.co/functions/v1/kb-push'

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
/** No iPhone o push só funciona com o app instalado na Tela de Início (iOS 16.4+) */
export const pushNeedsInstall = () => isIOS() && !isStandalone()

function b64ToUint8(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  if (reg) return reg
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
}

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  return (await reg?.pushManager.getSubscription()) ?? null
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('Este navegador não suporta notificações push')
  if (pushNeedsInstall()) throw new Error('No iPhone, instale o app na Tela de Início para receber notificações')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Permissão de notificação negada. Libere nas configurações do navegador.')
  const { publicKey } = await fetch(FN).then(r => r.json())
  const reg = await registration()
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ??
    await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) })
  const j = sub.toJSON()
  const { error } = await supabase.from('kb_push_subscriptions').upsert({
    endpoint: sub.endpoint, p256dh: j.keys!.p256dh, auth: j.keys!.auth, user_agent: navigator.userAgent.slice(0, 200),
  }, { onConflict: 'endpoint' })
  if (error) throw error
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase.from('kb_push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
