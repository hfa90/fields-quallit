import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, CheckCircle2, AlertTriangle, Send, KeyRound, ExternalLink, CalendarClock, ThumbsDown, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { cn, errMsg, timeAgo } from '../lib/utils'
import { LIST_COLS } from '../lib/library'
import type { TutorialListItem } from '../lib/types'
import { Button, Spinner, inputCls, labelCls } from '../components/ui'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://wrmlmtxkukjxkivtsuex.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_P1k3Dual0gTDKLApeGseyQ_Ym_HaIWN'

export async function azureEnabled(): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } })
    const j = await r.json()
    return !!j?.external?.azure
  } catch { return false }
}

function Status({ ok, label }: { ok: boolean | null; label: [string, string] }) {
  if (ok === null) return <span className="text-[13px] text-neutral-400">verificando…</span>
  return ok
    ? <span className="inline-flex items-center gap-1 rounded-full bg-[#34c759]/15 px-2.5 py-0.5 text-[12px] font-semibold text-[#248a3d] dark:text-[#30d158]"><CheckCircle2 className="size-3.5" />{label[0]}</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/15 px-2.5 py-0.5 text-[12px] font-semibold text-brand-orange-dark"><AlertTriangle className="size-3.5" />{label[1]}</span>
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-500/10 text-[12px] font-semibold text-accent-700 dark:text-accent-300">{n}</span>
      <div className="min-w-0 flex-1 text-[14px] leading-relaxed text-neutral-700 dark:text-neutral-300">{children}</div>
    </li>
  )
}

function CopyField({ value }: { value: string }) {
  return (
    <span className="mt-1 flex items-center gap-2 rounded-lg bg-neutral-100 px-2.5 py-1.5 font-mono text-[12px] text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
      <span className="min-w-0 flex-1 truncate">{value}</span>
      <button onClick={() => { navigator.clipboard.writeText(value); toast.success('Copiado') }} className="text-accent-600"><Copy className="size-3.5" /></button>
    </span>
  )
}

export function IntegrationsTab() {
  const [email, setEmail] = useState<{ configured: boolean; from: string | null } | null>(null)
  const [azure, setAzure] = useState<boolean | null>(null)
  const [key, setKey] = useState('')
  const [from, setFrom] = useState('')
  const [busy, setBusy] = useState<'save' | 'test' | null>(null)

  const load = () => supabase.rpc('kb_email_config_status').then(({ data }) => { setEmail(data as typeof email); setFrom((data as { from?: string })?.from ?? '') })
  useEffect(() => { load(); azureEnabled().then(setAzure) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!email?.configured && !key.trim()) return toast.error('Cole a chave da API do Resend')
    setBusy('save')
    const { error } = await supabase.rpc('kb_email_config_set', { p_api_key: key, p_from: from })
    setBusy(null)
    if (error) return toast.error(errMsg(error))
    setKey(''); toast.success('Configuração de e-mail salva'); load()
  }
  const test = async () => {
    setBusy('test')
    const { error } = await supabase.rpc('kb_email_test')
    setBusy(null)
    if (error) return toast.error(errMsg(error))
    toast.success('E-mail de teste enviado para você', { description: 'Se não chegar em 1 minuto, confira o spam e o remetente/domínio no Resend.' })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* E-mail */}
      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[17px] font-semibold text-neutral-900 dark:text-white"><Mail className="size-5 text-accent-600" />Notificações por e-mail</h3>
          <Status ok={email ? email.configured : null} label={['Ativo', 'Não configurado']} />
        </div>
        <p className="text-[14px] text-neutral-500">Os e-mails são enviados pelo <b>Resend</b> (plano grátis: 3.000 e-mails/mês). Cada pessoa escolhe em Notificações se quer resumo diário (padrão), e-mail imediato ou nenhum.</p>
        <ol className="space-y-3">
          <Step n={1}>Crie uma conta grátis em <a href="https://resend.com/signup" target="_blank" rel="noopener noreferrer" className="font-medium text-accent-600">resend.com <ExternalLink className="inline size-3" /></a>.</Step>
          <Step n={2}>Em <b>Domains</b>, adicione o domínio da empresa (ex.: <code>quallit.com.br</code>) e crie os registros DNS que o Resend mostrar. <span className="text-neutral-500">Sem domínio verificado, o Resend só entrega para o e-mail dono da conta.</span></Step>
          <Step n={3}>Em <b>API Keys</b>, crie uma chave com permissão <b>Sending access</b> e cole abaixo.</Step>
        </ol>
        <div>
          <label className={labelCls}>Chave da API do Resend</label>
          <input type="password" autoComplete="off" className={inputCls} value={key} onChange={e => setKey(e.target.value)} placeholder={email?.configured ? '•••••••• (já configurada — preencha só para trocar)' : 're_...'} />
        </div>
        <div>
          <label className={labelCls}>Remetente</label>
          <input className={inputCls} value={from} onChange={e => setFrom(e.target.value)} placeholder="Fields Quallit <fields@quallit.com.br>" />
        </div>
        <p className="text-[12px] text-neutral-500">A chave fica guardada no servidor e nunca é exibida de novo, nem para administradores.</p>
        <div className="flex gap-2">
          <Button loading={busy === 'save'} onClick={save}><KeyRound className="size-4" />Salvar</Button>
          <Button variant="secondary" loading={busy === 'test'} disabled={!email?.configured} onClick={test}><Send className="size-4" />Enviar e-mail de teste</Button>
        </div>
      </section>

      {/* Microsoft */}
      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[17px] font-semibold text-neutral-900 dark:text-white"><MicrosoftLogo />Login com Microsoft</h3>
          <Status ok={azure} label={['Ativo no login', 'Não configurado']} />
        </div>
        <p className="text-[14px] text-neutral-500">Permite entrar com o e-mail corporativo (ex.: <code>@rd.com.br</code>) em um clique. Quem já tem conta com o mesmo e-mail continua com o mesmo perfil e tutoriais. O botão aparece no login assim que estiver configurado.</p>
        <ol className="space-y-3">
          <Step n={1}>No <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="font-medium text-accent-600">portal do Azure <ExternalLink className="inline size-3" /></a> → <b>Microsoft Entra ID → Registros de aplicativo → Novo registro</b>. Nome: <i>Fields Quallit</i>. Tipo de conta: <b>somente este diretório organizacional</b>. URI de redirecionamento (<b>Web</b>):
            <CopyField value={`${SUPABASE_URL}/auth/v1/callback`} /></Step>
          <Step n={2}>Em <b>Configuração de token → Adicionar declaração opcional → ID</b>, marque <b>email</b>.</Step>
          <Step n={3}>Em <b>Certificados e segredos → Novo segredo do cliente</b>, copie o <b>Valor</b>. Na página <b>Visão geral</b>, copie o <b>ID do aplicativo (cliente)</b> e o <b>ID do diretório (locatário)</b>.</Step>
          <Step n={4}>No <a href="https://supabase.com/dashboard/project/wrmlmtxkukjxkivtsuex/auth/providers" target="_blank" rel="noopener noreferrer" className="font-medium text-accent-600">Supabase → Authentication → Providers <ExternalLink className="inline size-3" /></a>, abra <b>Azure</b>, ative e cole o ID do cliente e o segredo. Em <b>Azure Tenant URL</b> use:
            <CopyField value="https://login.microsoftonline.com/SEU-ID-DO-LOCATARIO" /></Step>
          <Step n={5}>Volte aqui e recarregue: o status muda para <b>Ativo</b> e o botão “Entrar com Microsoft” aparece no login.</Step>
        </ol>
        <Button variant="secondary" onClick={() => { setAzure(null); azureEnabled().then(setAzure) }}>Verificar novamente</Button>
      </section>
    </div>
  )
}

export function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={cn('size-5', className)} aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

/** Tutoriais que precisam de atenção: revisão vencida, passo desatualizado ou avaliação ruim */
export function ReviewTab() {
  const [rows, setRows] = useState<TutorialListItem[] | null>(null)
  useEffect(() => {
    supabase.from('kb_tutorials_list').select(LIST_COLS).eq('status', 'published').order('reviewed_at', { ascending: true }).limit(300)
      .then(({ data }) => {
        const all = (data as unknown as TutorialListItem[]) ?? []
        setRows(all.filter(t => t.review_due || (t.outdated_count ?? 0) > 0 || ((t.not_helpful_count ?? 0) >= 2 && (t.not_helpful_count ?? 0) > (t.helpful_count ?? 0))))
      })
  }, [])
  if (!rows) return <Spinner />
  if (!rows.length) return (
    <div className="card flex flex-col items-center p-10 text-center">
      <CheckCircle2 className="size-12 text-[#34c759]" strokeWidth={1.4} />
      <p className="mt-3 text-[17px] font-semibold text-neutral-900 dark:text-white">Biblioteca em dia</p>
      <p className="text-[14px] text-neutral-500">Nenhum tutorial com revisão vencida ou relato de problema.</p>
    </div>
  )
  return (
    <div className="space-y-3">
      <p className="px-1 text-[14px] text-neutral-500">Os autores recebem lembrete automático às 8h quando a revisão vence. Aqui você acompanha tudo o que precisa de atenção.</p>
      <div className="card divide-y divide-neutral-200/70 overflow-hidden dark:divide-neutral-800">
        {rows.map(t => (
          <Link key={t.id} to={`/t/${t.short_code}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-900/[.02] dark:hover:bg-white/[.03]">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-neutral-900 dark:text-white">{t.title}</div>
              <div className="text-[12px] text-neutral-500">{t.author_name} · revisado {t.reviewed_at ? timeAgo(t.reviewed_at) : '—'}</div>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5 text-[12px] font-medium">
              {t.review_due && <span className="inline-flex items-center gap-1 rounded-md bg-neutral-900/[.06] px-1.5 py-0.5 text-neutral-600 dark:bg-white/10 dark:text-neutral-300"><CalendarClock className="size-3" />Vencida</span>}
              {!!t.outdated_count && <span className="inline-flex items-center gap-1 rounded-md bg-brand-orange/10 px-1.5 py-0.5 text-brand-orange-dark"><AlertTriangle className="size-3" />{t.outdated_count}</span>}
              {(t.not_helpful_count ?? 0) > (t.helpful_count ?? 0) && <span className="inline-flex items-center gap-1 rounded-md bg-[#ff3b30]/10 px-1.5 py-0.5 text-[#d70015]"><ThumbsDown className="size-3" />{t.not_helpful_count}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
