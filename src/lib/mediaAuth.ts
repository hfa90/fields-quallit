import { supabase, IMAGES_BUCKET } from './supabase'

// O bucket kb-images é privado: só usuários logados da central veem imagens e vídeos.
// O HTML dos tutoriais continua guardando a URL "/object/public/kb-images/<caminho>" como identificador;
// quem resolve o acesso é o service worker (sw.js), que busca o arquivo com o login do usuário.
// Quando a página não está sob o service worker (1ª visita, recarga forçada), assinamos o link aqui.

const MARK = `/storage/v1/object/public/${IMAGES_BUCKET}/`
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_P1k3Dual0gTDKLApeGseyQ_Ym_HaIWN'

export const isPrivateMedia = (url: string | null | undefined) => !!url && url.includes(MARK)
const pathOf = (url: string) => decodeURIComponent(url.split(MARK)[1].split(/[?#]/)[0])

async function signed(url: string) {
  const { data } = await supabase.storage.from(IMAGES_BUCKET).createSignedUrl(pathOf(url), 3600)
  return data?.signedUrl ?? null
}

/** Baixa uma mídia de tutorial (com ou sem service worker) */
export async function fetchMedia(url: string): Promise<Response> {
  if (isPrivateMedia(url) && !navigator.serviceWorker?.controller) {
    const s = await signed(url)
    if (s) return fetch(s)
  }
  return fetch(url, { mode: 'cors' })
}

export function initMediaAuth() {
  // O service worker pede o login atual quando precisa buscar uma imagem privada
  navigator.serviceWorker?.addEventListener('message', e => {
    if (e.data?.type !== 'fq-media-token' || !e.ports[0]) return
    supabase.auth.getSession().then(({ data }) => e.ports[0].postMessage({ token: data.session?.access_token ?? null, apikey: KEY }))
  })

  // Reserva: imagem/vídeo que falhou (página fora do service worker) ganha um link assinado, uma vez
  document.addEventListener('error', ev => {
    const el = ev.target as HTMLImageElement | HTMLVideoElement | HTMLSourceElement | null
    if (!el || !('src' in el) || !isPrivateMedia(el.src) || el.dataset.fqSigned) return
    if (el.closest('.ProseMirror')) return // no editor, trocar o src iria parar no conteúdo salvo
    el.dataset.fqSigned = '1'
    signed(el.src).then(s => { if (s) el.src = s })
  }, true)
}
