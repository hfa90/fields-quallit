import { useState } from 'react'
import { toast } from 'sonner'
import { Camera, Save, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { uploadImage } from '../lib/upload'
import { Avatar, Button, inputCls, labelCls } from '../components/ui'
import { ROLE_LABEL, ROLE_STYLE, cn, errMsg } from '../lib/utils'

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth()
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
    <div className="mx-auto max-w-xl space-y-6 fade-up">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Meu perfil</h1>
      <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex items-center gap-4">
          <label className="group relative cursor-pointer">
            <Avatar name={profile.full_name} email={profile.email} url={profile.avatar_url} size={72} />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100"><Camera className="size-5" /></span>
            <input type="file" accept="image/*" hidden onChange={e => changeAvatar(e.target.files?.[0])} />
          </label>
          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">{profile.full_name}</div>
            <div className="text-sm text-slate-500">{profile.email}</div>
            <span className={cn('mt-1 inline-block rounded-lg px-2 py-0.5 text-xs font-semibold', ROLE_STYLE[profile.role])}>{ROLE_LABEL[profile.role]}</span>
          </div>
        </div>
        <div className="mt-6">
          <label className={labelCls}>Nome de exibição</label>
          <div className="flex gap-2">
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} />
            <Button loading={busy} onClick={saveName}><Save className="size-4" />Salvar</Button>
          </div>
        </div>
      </section>
      <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <label className={labelCls}>Nova senha</label>
        <div className="flex gap-2">
          <input type="password" className={inputCls} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
          <Button variant="outline" loading={pwBusy} onClick={changePw}><KeyRound className="size-4" />Alterar</Button>
        </div>
      </section>
    </div>
  )
}
