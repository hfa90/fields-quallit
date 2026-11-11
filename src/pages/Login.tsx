import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { Button, inputCls } from '../components/ui'
import { Logo } from '../components/Layout'
import { cn, errMsg } from '../lib/utils'

type Mode = 'login' | 'forgot'

import { PUBLIC_URL } from '../lib/native'

// Links de recuperação de senha sempre levam ao site público (abre no navegador ou no app)
const appUrl = () => `${PUBLIC_URL}/`

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error.message.includes('Invalid login') ? new Error('E-mail ou senha incorretos') : error
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() })
        if (error) throw error
        setSent('Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Se não chegar, peça ao administrador para redefinir sua senha.')
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
            {mode === 'login' ? 'Fields' : 'Recuperar senha'}
          </h1>
          <p className="mt-1 text-[15px] text-neutral-500">
            {mode === 'login' ? 'Central de tutoriais · Quallit Soluções em TI' : 'Enviaremos um link para o seu e-mail'}
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
              <input required type="email" className={cn(inputCls, field)} value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" autoComplete="email" inputMode="email" autoCapitalize="none" />
              {mode === 'login' && (
                <input required type="password" className={cn(inputCls, field)} value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" autoComplete="current-password" />
              )}
            </div>
            <Button type="submit" loading={busy} className="h-12 w-full text-[17px] font-semibold">
              {mode === 'login' ? 'Entrar' : 'Enviar link'}
            </Button>
            {mode === 'login' && (
              <p className="text-center text-[13px] leading-relaxed text-neutral-500">
                Acesso restrito a usuários cadastrados pelo administrador.<br />Usuários do Inventário Quallit entram com o mesmo e-mail e senha.
              </p>
            )}
          </form>
        )}

        <div className="mt-8 flex flex-col items-center gap-3 text-[15px]">
          {mode === 'login'
            ? <button onClick={() => setMode('forgot')} className="font-medium text-accent-600 dark:text-accent-400">Esqueci minha senha</button>
            : <button onClick={() => { setMode('login'); setSent(null) }} className="font-medium text-accent-600 dark:text-accent-400">Voltar para o login</button>}
        </div>
      </div>
    </div>
  )
}
