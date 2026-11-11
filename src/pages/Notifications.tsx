import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BellRing, Smartphone, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useNotifications } from '../lib/notifications'
import { currentSubscription, disablePush, enablePush, pushNeedsInstall, pushSupported } from '../lib/push'
import { errMsg } from '../lib/utils'
import NotificationList from '../components/NotificationList'
import { SectionTitle } from '../components/ui'
import { openInstallPrompt } from '../components/InstallApp'

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors disabled:opacity-40 ${checked ? 'bg-[#34c759]' : 'bg-neutral-200 dark:bg-neutral-700'}`}>
      <span className={`absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2)] transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
    </button>
  )
}

const PREFS = [
  ['notify_new', 'Novos tutoriais', 'Das categorias e pessoas que você segue'],
  ['notify_updates', 'Atualizações', 'Quando um tutorial favorito é alterado'],
  ['notify_comments', 'Comentários e avaliações', 'Nos seus tutoriais e respostas aos seus comentários'],
  ['notify_requests', 'Pedidos da comunidade', 'Novos pedidos nas categorias que você segue e pedidos atendidos'],
] as const
type PrefKey = typeof PREFS[number][0]

export function PushSettings() {
  const { profile } = useAuth()
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({ notify_new: true, notify_updates: true, notify_comments: true, notify_requests: true })
  const [emailMode, setEmailMode] = useState<'off' | 'instant' | 'daily'>('daily')

  useEffect(() => {
    currentSubscription().then(s => setOn(!!s && Notification.permission === 'granted')).catch(() => {})
    supabase.from('kb_notification_prefs').select('*').maybeSingle().then(({ data }) => { if (data) { setPrefs(data); setEmailMode(data.email_mode ?? 'daily') } })
  }, [])

  const togglePush = async (v: boolean) => {
    if (v && pushNeedsInstall()) { openInstallPrompt(); return }
    setBusy(true)
    try {
      if (v) { await enablePush(); toast.success('Notificações ativadas neste aparelho') }
      else { await disablePush(); toast('Notificações desativadas neste aparelho') }
      setOn(v)
    } catch (e) { toast.error(errMsg(e)) } finally { setBusy(false) }
  }
  const setPref = async (k: PrefKey, v: boolean) => {
    const next = { ...prefs, [k]: v }
    setPrefs(next)
    const { error } = await supabase.from('kb_notification_prefs').upsert({ user_id: profile!.id, ...next, email_mode: emailMode })
    if (error) toast.error(errMsg(error))
  }
  const setEmail = async (m: typeof emailMode) => {
    setEmailMode(m)
    const { error } = await supabase.from('kb_notification_prefs').upsert({ user_id: profile!.id, ...prefs, email_mode: m })
    if (error) toast.error(errMsg(error)); else toast.success(m === 'off' ? 'E-mails desativados' : m === 'instant' ? 'Você receberá um e-mail a cada novidade' : 'Você receberá um resumo diário às 8h')
  }

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>Neste aparelho</SectionTitle>
        <div className="card overflow-hidden">
          <div className="flex min-h-14 items-center gap-3 px-4 py-2">
            <span className="grid size-7 place-items-center rounded-[7px] bg-[#ff3b30] text-white"><BellRing className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] text-neutral-900 dark:text-white">Notificações push</div>
              <div className="text-[13px] text-neutral-500">
                {!pushSupported() && !pushNeedsInstall() ? 'Não suportado neste navegador'
                  : pushNeedsInstall() ? 'No iPhone, instale o app para ativar'
                  : 'Avisos no celular mesmo com o app fechado'}
              </div>
            </div>
            <Toggle checked={on} disabled={busy || (!pushSupported() && !pushNeedsInstall())} onChange={togglePush} />
          </div>
          {pushNeedsInstall() && (
            <button onClick={openInstallPrompt} className="flex min-h-12 w-full items-center gap-3 border-t border-neutral-200/70 px-4 text-left text-[15px] font-medium text-accent-600 dark:border-neutral-800 dark:text-accent-400">
              <Smartphone className="size-4" />Como instalar no iPhone
            </button>
          )}
        </div>
      </section>
      <section>
        <SectionTitle>Por e-mail · {profile?.email}</SectionTitle>
        <div className="card divide-y divide-neutral-200/70 overflow-hidden dark:divide-neutral-800">
          {([['daily', 'Resumo diário', 'Um e-mail às 8h com o que você ainda não viu'], ['instant', 'A cada novidade', 'Um e-mail na hora para cada notificação'], ['off', 'Não enviar e-mails', 'Só notificações no app e no celular']] as const).map(([k, t, d]) => (
            <button key={k} onClick={() => setEmail(k)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left">
              <Mail className={`size-5 ${emailMode === k ? 'text-accent-600' : 'text-neutral-300 dark:text-neutral-600'}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[16px] text-neutral-900 dark:text-white">{t}</div>
                <div className="text-[13px] text-neutral-500">{d}</div>
              </div>
              {emailMode === k && <span className="text-[17px] font-semibold text-accent-600">✓</span>}
            </button>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle>Quero ser avisado sobre</SectionTitle>
        <div className="card divide-y divide-neutral-200/70 overflow-hidden dark:divide-neutral-800">
          {PREFS.map(([k, t, d]) => (
            <div key={k} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-[16px] text-neutral-900 dark:text-white">{t}</div>
                <div className="text-[13px] text-neutral-500">{d}</div>
              </div>
              <Toggle checked={prefs[k]} onChange={v => setPref(k, v)} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function NotificationsPage() {
  const { unread, markRead } = useNotifications()
  const [tab, setTab] = useState<'list' | 'settings'>('list')
  return (
    <div className="mx-auto max-w-2xl space-y-5 fade-up">
      <div className="flex items-end justify-between pt-1">
        <h1 className="text-[32px] font-bold tracking-tight text-neutral-900 dark:text-white">Notificações</h1>
        {tab === 'list' && unread > 0 && <button onClick={() => markRead()} className="pb-1.5 text-[15px] font-medium text-accent-600 dark:text-accent-400">Marcar todas como lidas</button>}
      </div>
      <div className="grid grid-cols-2 rounded-[9px] bg-neutral-900/[.06] p-0.5 dark:bg-white/10">
        {([['list', `Recebidas${unread ? ` (${unread})` : ''}`], ['settings', 'Configurações']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`h-8 rounded-[7px] text-[13px] font-medium transition ${tab === k ? 'bg-white text-neutral-900 shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-neutral-600 dark:text-white' : 'text-neutral-600 dark:text-neutral-300'}`}>{l}</button>
        ))}
      </div>
      {tab === 'list' ? <div className="card overflow-hidden"><NotificationList /></div> : <PushSettings />}
    </div>
  )
}
