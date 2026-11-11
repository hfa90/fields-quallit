import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from './types'

interface AuthCtx {
  session: Session | null
  profile: Profile | null
  loading: boolean
  recovering: boolean
  isMember: boolean
  isModerator: boolean
  isAdmin: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
  finishRecovery: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); return }
    const { data, error } = await supabase.rpc('kb_ensure_profile')
    if (error) { console.error(error); setProfile(null); return }
    setProfile(data as Profile)
  }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await loadProfile(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(s)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // adia para fora do callback (recomendação do supabase-js)
        setTimeout(() => { loadProfile(s) }, 0)
      }
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  const role = profile?.role
  const value: AuthCtx = {
    session,
    profile,
    loading,
    recovering,
    isMember: role === 'admin' || role === 'field_admin' || role === 'field',
    isModerator: role === 'admin' || role === 'field_admin',
    isAdmin: role === 'admin',
    refreshProfile: () => loadProfile(session),
    signOut: async () => { await supabase.auth.signOut(); setProfile(null) },
    finishRecovery: () => setRecovering(false),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth fora do AuthProvider')
  return c
}
