import { Clock, Ban, RefreshCw, LogOut } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Button } from '../components/ui'

export default function Pending() {
  const { profile, refreshProfile, signOut } = useAuth()
  const blocked = profile?.role === 'blocked'
  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <div className="max-w-md text-center fade-up">
        <div className={`mx-auto mb-6 grid size-16 place-items-center rounded-2xl ${blocked ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/15'}`}>
          {blocked ? <Ban className="size-8" /> : <Clock className="size-8" />}
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{blocked ? 'Acesso bloqueado' : 'Cadastro em análise'}</h1>
        <p className="mt-3 text-slate-500">
          {blocked
            ? 'Seu acesso à central de tutoriais foi bloqueado por um administrador.'
            : <>Olá, <strong className="text-slate-700 dark:text-slate-300">{profile?.full_name}</strong>! Seu cadastro foi recebido. Um administrador precisa definir seu nível de acesso (Field ou Field Administrador) para liberar a central.</>}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          {!blocked && <Button variant="outline" onClick={refreshProfile}><RefreshCw className="size-4" />Verificar novamente</Button>}
          <Button variant="ghost" onClick={signOut}><LogOut className="size-4" />Sair</Button>
        </div>
      </div>
    </div>
  )
}
