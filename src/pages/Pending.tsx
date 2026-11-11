import { Clock, Ban } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Button } from '../components/ui'

export default function Pending() {
  const { profile, refreshProfile, signOut } = useAuth()
  const blocked = profile?.role === 'blocked'
  return (
    <div className="pt-safe pb-safe grid min-h-dvh place-items-center p-6">
      <div className="max-w-sm text-center fade-up">
        <div className="mx-auto mb-5 text-neutral-300 dark:text-neutral-600">
          {blocked ? <Ban className="mx-auto size-14" strokeWidth={1.4} /> : <Clock className="mx-auto size-14" strokeWidth={1.4} />}
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-neutral-900 dark:text-white">{blocked ? 'Acesso bloqueado' : 'Aguardando aprovação'}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500">
          {blocked
            ? 'Seu acesso à central foi bloqueado por um administrador.'
            : <>Olá, {profile?.full_name}. Seu cadastro foi recebido — um administrador vai definir seu nível de acesso em breve.</>}
        </p>
        <div className="mt-8 flex flex-col gap-2">
          {!blocked && <Button onClick={refreshProfile} className="h-11">Verificar novamente</Button>}
          <Button variant="ghost" onClick={signOut} className="h-11 text-[#ff3b30]">Sair</Button>
        </div>
      </div>
    </div>
  )
}
