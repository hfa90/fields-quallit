import { supabase, IMAGES_BUCKET } from './supabase'
import { safeFileName } from './utils'

export async function uploadImage(file: File, userId: string) {
  if (!file.type.startsWith('image/')) throw new Error('Arquivo não é uma imagem')
  if (file.size > 10 * 1024 * 1024) throw new Error('Imagem maior que 10 MB')
  const path = `${userId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
  const { error } = await supabase.storage.from(IMAGES_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) throw error
  return supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
}


export async function uploadVideo(file: File, userId: string) {
  if (!file.type.startsWith('video/')) throw new Error('Arquivo não é um vídeo')
  if (file.size > 50 * 1024 * 1024) throw new Error('Vídeo maior que 50 MB. Grave um trecho mais curto.')
  const path = `${userId}/video/${crypto.randomUUID()}-${safeFileName(file.name || 'video.mp4')}`
  const { error } = await supabase.storage.from(IMAGES_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) throw error
  return supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
}
