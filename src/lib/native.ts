import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'

/** true quando o site está rodando dentro do app Android (Capacitor) */
export const isNative = Capacitor.isNativePlatform()

/** Endereço público do site (links curtos e de recuperação de senha precisam apontar para ele, não para o app) */
export const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL || 'https://hfa90.github.io/fields-quallit').replace(/\/$/, '')

/** Página pública para baixar o app Android */
export const ANDROID_PAGE = `${PUBLIC_URL}/android`
export const APK_URL = `${PUBLIC_URL}/downloads/fields.apk`

const SITE_HOST = new URL(PUBLIC_URL).host

/** Abre fora do app (navegador do celular): downloads, links externos */
export async function openExternal(url: string) {
  if (!isNative) { window.open(url, '_blank', 'noopener'); return }
  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url })
}

/** Compartilhamento nativo do Android (WhatsApp, Teams, e-mail…) */
export async function nativeShare(title: string, url: string) {
  const { Share } = await import('@capacitor/share')
  await Share.share({ title, text: title, url, dialogTitle: 'Compartilhar tutorial' })
}

export async function setNativeTheme(dark: boolean) {
  if (!isNative) return
  try { await SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }) } catch { /* ignore */ }
}

/** Inicializa comportamentos de app: botão voltar, links externos, splash */
export async function initNative() {
  if (!isNative) return
  document.documentElement.classList.add('native-app')
  const [{ App }, { SplashScreen }] = await Promise.all([import('@capacitor/app'), import('@capacitor/splash-screen')])

  // Botão "voltar" do Android: fecha janela aberta, volta uma tela ou minimiza o app na tela inicial
  App.addListener('backButton', () => {
    const closeBtn = document.querySelector<HTMLButtonElement>('[aria-label="Fechar"], [aria-label="Dispensar"]')
    if (closeBtn) { closeBtn.click(); return }
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    const atRoot = location.pathname === `${base}/` || location.pathname === base || location.pathname === `${base}/login`
    if (!atRoot && window.history.length > 1) window.history.back()
    else App.minimizeApp()
  })

  // Links para fora do site abrem no navegador do celular
  document.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null
    if (!a) return
    const href = a.href
    if (!/^https?:/i.test(href)) return
    let host = ''
    try { host = new URL(href).host } catch { return }
    if (host !== SITE_HOST || a.target === '_blank') {
      e.preventDefault()
      openExternal(href)
    }
  }, true)
  const nativeOpen = window.open.bind(window)
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    if (url && /^https?:/i.test(String(url))) { openExternal(String(url)); return null }
    return nativeOpen(url, target, features)
  }) as typeof window.open

  setNativeTheme(document.documentElement.classList.contains('dark'))
  setTimeout(() => SplashScreen.hide().catch(() => {}), 300)
}

/** Versão do app instalado e a última publicada (para avisar sobre atualização) */
export async function checkAppUpdate(): Promise<{ current: number; latest: number; name: string } | null> {
  if (!isNative) return null
  try {
    const { App } = await import('@capacitor/app')
    const info = await App.getInfo()
    const res = await fetch(`${import.meta.env.BASE_URL}downloads/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const v = await res.json() as { versionCode: number; versionName: string }
    const current = Number(info.build)
    return v.versionCode > current ? { current, latest: v.versionCode, name: v.versionName } : null
  } catch { return null }
}
