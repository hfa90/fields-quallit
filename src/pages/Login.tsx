import { useState } from 'react'
import { BookOpen, Mail, Lock, UserRound, ArrowRight, Share2, Eye, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { Button, inputCls, labelCls } from '../components/ui'
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

  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-sky-600 p-12 text-white">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur"><BookOpen className="size-6" /></span>
          <span className="text-lg font-bold">Fields Quallit</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">A biblioteca de soluções do time de campo.</h1>
          <p className="mt-4 text-indigo-100 text-lg">Tutoriais, procedimentos e arquivos em um só lugar — fáceis de achar, bonitos de ler e rápidos de compartilhar.</p>
          <div className="mt-10 space-y-4">
            {[
              [FileText, 'Editor rico com modelos prontos, imagens, vídeos e anexos'],
              [Share2, 'Link curto para compartilhar com um clique'],
              [Eye, 'Saiba quem já visualizou cada tutorial'],
            ].map(([Icon, t], i) => {
              const I = Icon as typeof FileText
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20"><I className="size-4.5" /></span>
                  <span className="text-indigo-50">{t as string}</span>
                </div>
              )
            })}
          </div>
        </div>
        <p className="relative text-sm text-indigo-200">© {new Date().getFullYear()} Quallit</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm fade-up">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white"><BookOpen className="size-6" /></span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">Fields Quallit</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {mode === 'login' ? 'Bem-vindo de volta' : mode === 'signup' ? 'Criar sua conta' : 'Recuperar senha'}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {mode === 'login' ? 'Entre para acessar a central de tutoriais.' : mode === 'signup' ? 'Após o cadastro, um administrador libera seu acesso.' : 'Informe seu e-mail para receber o link.'}
          </p>

          {mode !== 'forgot' && (
            <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
              {(['login', 'signup'] as Mode[]).map(m => (
                <button key={m} onClick={() => { setMode(m); setSent(null) }}
                  className={cn('rounded-lg py-2 text-sm font-semibold transition', mode === m ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500')}>
                  {m === 'login' ? 'Entrar' : 'Cadastrar'}
                </button>
              ))}
            </div>
          )}

          {sent ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              {sent}
              <button className="mt-3 block font-semibold underline" onClick={() => { setSent(null); setMode('login') }}>Voltar para o login</button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className={labelCls}>Nome completo</label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input required className={cn(inputCls, 'pl-10')} value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" />
                  </div>
                </div>
              )}
              <div>
                <label className={labelCls}>E-mail</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input required type="email" className={cn(inputCls, 'pl-10')} value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@empresa.com" autoComplete="email" />
                </div>
              </div>
              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Senha</label>
                    {mode === 'login' && <button type="button" onClick={() => setMode('forgot')} className="mb-1.5 text-xs font-medium text-indigo-600 hover:underline">Esqueci a senha</button>}
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input required type="password" className={cn(inputCls, 'pl-10')} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 8 : undefined} />
                  </div>
                </div>
              )}
              <Button type="submit" loading={busy} className="w-full">
                {mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'} <ArrowRight className="size-4" />
              </Button>
              {mode === 'forgot' && <button type="button" onClick={() => setMode('login')} className="w-full text-sm text-slate-500 hover:text-slate-800">Voltar</button>}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
