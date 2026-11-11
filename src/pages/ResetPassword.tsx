import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Button, inputCls, labelCls } from '../components/ui'
import { errMsg } from '../lib/utils'

export default function ResetPassword() {
  const { finishRecovery } = useAuth()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <form className="w-full max-w-sm space-y-4 fade-up" onSubmit={async e => {
        e.preventDefault()
        if (pw.length < 8) return toast.error('A senha precisa ter pelo menos 8 caracteres')
        setBusy(true)
        const { error } = await supabase.auth.updateUser({ password: pw })
        setBusy(false)
        if (error) return toast.error(errMsg(error))
        toast.success('Senha atualizada!')
        finishRecovery()
      }}>
        <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-accent-100 text-accent-600 dark:bg-accent-500/15"><KeyRound className="size-7" /></div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Defina uma nova senha</h1>
        <div>
          <label className={labelCls}>Nova senha</label>
          <input type="password" autoFocus className={inputCls} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" minLength={8} required />
        </div>
        <Button type="submit" loading={busy} className="w-full">Salvar nova senha</Button>
      </form>
    </div>
  )
}
