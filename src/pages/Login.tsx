import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { Button, inputCls } from '../components/ui'
import { Logo } from '../components/Layout'
import { cn, errMsg } from '../lib/utils'

type Mode = 'login' | 'signup' | 'forgot'

const appUrl = () => window.location.origin + import.meta.env.BASE_URL

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error.message.includes('Invalid login') ? new Error('E-mail ou senha incorretos') : error
      } else if (mode === 'signup') {
        if (password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres')
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: appUrl() },
        })
        if (error) throw error
        if (!data.session) setSent('Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, volte aqui e entre.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() })
        if (error) throw error
        setSent('Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.')
      }
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  const field = 'rounded-none shadow-none focus:shadow-none bg-transparent dark:bg-transparent dark:shadow-none h-12'

  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[360px] fade-up">
        <div className="flex flex-col items-center text-center">
          <Logo size={64} />
          <h1 className="mt-5 text-[28px] font-bold tracking-tight text-neutral-900 dark:text-white">
            {mode === 'login' ? 'Fields' : mode === 'signup' ? 'Criar conta' : 'Recuperar senha'}
          </h1>
          <p className="mt-1 text-[15px] text-neutral-500">
            {mode === 'login' ? 'Central de tutoriais · Quallit Soluções em TI'
              : mode === 'signup' ? 'Um administrador libera seu acesso após o cadastro'
              : 'Enviaremos um link para o seu e-mail'}
          </p>
        </div>

        {sent ? (
          <div className="card mt-8 p-5 text-center text-[15px] text-neutral-700 dark:text-neutral-300">
            {sent}
            <button className="mt-4 block w-full font-medium text-accent-600" onClick={() => { setSent(null); setMode('login') }}>Voltar para o login</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="card divide-y divide-neutral-200 overflow-hidden dark:divide-neutral-800">
              {mode === 'signup' && (
                <input required className={cn(inputCls, field)} value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" autoComplete="name" />
              )}
              <input required type="email" className={cn(inputCls, field)} value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" autoComplete="email" inputMode="email" autoCapitalize="none" />
              {mode !== 'forgot' && (
                <input required type="password" className={cn(inputCls, field)} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Senha (mín. 8 caracteres)' : 'Senha'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 8 : undefined} />
              )}
            </div>
            <Button type="submit" loading={busy} className="h-12 w-full text-[17px] font-semibold">
              {mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}
            </Button>
            {mode === 'login' && (
              <p className="text-center text-[13px] text-neutral-500">Use o mesmo e-mail e senha do Inventário Quallit.</p>
            )}
          </form>
        )}

        <div className="mt-8 flex flex-col items-center gap-3 text-[15px]">
          {mode === 'login' && <>
            <button onClick={() => setMode('forgot')} className="font-medium text-accent-600 dark:text-accent-400">Esqueci minha senha</button>
            <div className="text-neutral-500">Não tem conta? <button onClick={() => { setMode('signup'); setSent(null) }} className="font-medium text-accent-600 dark:text-accent-400">Cadastre-se</button></div>
          </>}
          {mode !== 'login' && <button onClick={() => { setMode('login'); setSent(null) }} className="font-medium text-accent-600 dark:text-accent-400">Já tenho conta</button>}
        </div>
      </div>
    </div>
  )
}
