import { createClient } from '@supabase/supabase-js'

// Chave publicável: feita para ficar no front-end. A segurança é garantida pelas políticas RLS.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://wrmlmtxkukjxkivtsuex.supabase.co'
const key = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_P1k3Dual0gTDKLApeGseyQ_Ym_HaIWN'

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'fq-kb-auth',
  },
})

export const IMAGES_BUCKET = 'kb-images'
export const ATTACHMENTS_BUCKET = 'kb-attachments'
