import { useState } from 'react'
import { toast } from 'sonner'
import { Camera, LogOut, ChevronRight, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { uploadImage } from '../lib/upload'
import { Avatar, Button, SectionTitle } from '../components/ui'
import { ROLE_LABEL, errMsg } from '../lib/utils'
import { InstallRow, isStandalone } from '../components/InstallApp'

const row = 'flex items-center gap-3 px-4 min-h-12'
const fieldCls = 'min-w-0 flex-1 bg-transparent py-3 text-right text-[16px] text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white'

export default function ProfilePage() {
  const { profile, refreshProfile, signOut, isAdmin } = useAuth()
  const nav = useNavigate()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  if (!profile) return null

  const saveName = async () => {
    setBusy(true)
    const { error } = await supabase.from('kb_profiles').update({ full_name: name.trim() }).eq('id', profile.id)
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    await refreshProfile(); toast.success('Perfil atualizado')
  }
  const changeAvatar = async (f?: File) => {
    if (!f) return
    try {
      const url = await uploadImage(f, profile.id)
      const { error } = await supabase.from('kb_profiles').update({ avatar_url: url }).eq('id', profile.id)
      if (error) throw error
      await refreshProfile(); toast.success('Foto atualizada')
    } catch (e) { toast.error(errMsg(e)) }
  }
  const changePw = async () => {
    if (pw.length < 8) return toast.error('Mínimo de 8 caracteres')
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPwBusy(false)
    if (error) return toast.error(errMsg(error))
    setPw(''); toast.success('Senha alterada')
  }

  return (
    <div className="mx-auto max-w-xl space-y-7 fade-up">
      <h1 className="pt-1 text-[32px] font-bold tracking-tight text-neutral-900 dark:text-white">Perfil</h1>

      <div className="flex flex-col items-center text-center">
        <label className="group relative cursor-pointer">
          <Avatar name={profile.full_name} email={profile.email} url={profile.avatar_url} size={88} />
          <span className="absolute bottom-0 right-0 grid size-7 place-items-center rounded-full bg-accent-600 text-white ring-2 ring-neutral-50 dark:ring-neutral-950"><Camera className="size-3.5" /></span>
          <input type="file" accept="image/*" hidden onChange={e => changeAvatar(e.target.files?.[0])} />
        </label>
        <div className="mt-3 text-[20px] font-semibold text-neutral-900 dark:text-white">{profile.full_name}</div>
        <div className="text-[15px] text-neutral-500">{ROLE_LABEL[profile.role]}</div>
      </div>

      <section>
        <SectionTitle>Conta</SectionTitle>
        <div className="card divide-y divide-neutral-200/70 overflow-hidden dark:divide-neutral-800">
          <label className={row}>
            <span className="text-[16px] text-neutral-900 dark:text-white">Nome</span>
            <input className={fieldCls} value={name} onChange={e => setName(e.target.value)} onBlur={() => name.trim() && name.trim() !== profile.full_name && saveName()} />
          </label>
          <div className={row}>
            <span className="text-[16px] text-neutral-900 dark:text-white">E-mail</span>
            <span className="ml-auto truncate text-[16px] text-neutral-500">{profile.email}</span>
          </div>
        </div>
        {busy && <p className="mt-2 px-4 text-[13px] text-neutral-500">Salvando…</p>}
      </section>

      <section>
        <SectionTitle>Segurança</SectionTitle>
        <div className="card overflow-hidden">
          <div className={row}>
            <span className="shrink-0 text-[16px] text-neutral-900 dark:text-white">Nova senha</span>
            <input type="password" className={fieldCls} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" placeholder="mín. 8 caracteres" />
          </div>
        </div>
        {pw && <Button className="mt-3 w-full" loading={pwBusy} onClick={changePw}>Alterar senha</Button>}
        <p className="mt-2 px-4 text-[13px] text-neutral-500">A senha é a mesma do Inventário Quallit.</p>
      </section>

      {isAdmin && (
        <div className="card overflow-hidden md:hidden">
          <button onClick={() => nav('/admin')} className={`${row} w-full text-left`}>
            <span className="grid size-7 place-items-center rounded-[7px] bg-accent-600 text-white"><ShieldCheck className="size-4" /></span>
            <span className="flex-1 text-[16px] text-neutral-900 dark:text-white">Administração</span>
            <ChevronRight className="size-5 text-neutral-300 dark:text-neutral-600" />
          </button>
        </div>
      )}

      {!isStandalone() && <div className="card overflow-hidden"><InstallRow /></div>}

      <div className="card overflow-hidden">
        <button onClick={signOut} className={`${row} w-full justify-center text-[16px] text-[#ff3b30]`}><LogOut className="size-4" />Sair</button>
      </div>
    </div>
  )
}
