import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Plus, LogOut, Moon, Sun, UserRound, Library, Search, Bell, Users, Settings } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useNotifications } from '../lib/notifications'
import { supabase } from '../lib/supabase'
import { ROLE_LABEL, cn } from '../lib/utils'
import { Avatar } from './ui'
import { QuallitMark } from './QuallitLogo'
import { SearchPalette, openSearch } from './Search'
import NotificationList from './NotificationList'
import { refreshOffline, useOnline } from '../lib/offline'
import { WifiOff } from 'lucide-react'

export function Logo({ size = 30 }: { size?: number }) {
  return <QuallitMark size={size} />
}

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth()
  const { unread, markRead } = useNotifications()
  const nav = useNavigate()
  const loc = useLocation()
  const [menu, setMenu] = useState<'account' | 'notif' | null>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)

  // Fecha o menu aberto ao tocar/clicar em qualquer lugar fora dele ou ao apertar Esc
  useEffect(() => {
    if (!menu) return
    const box = menu === 'notif' ? notifRef : accountRef
    const outside = (e: Event) => { if (!box.current?.contains(e.target as Node)) setMenu(null) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null) }
    const close = () => setMenu(null)
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', esc)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('resize', close)
    }
  }, [menu])
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [pending, setPending] = useState(0)
  const mac = /Mac|iPhone|iPad/.test(navigator.platform)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#f5f5f7')
    try { localStorage.setItem('fq-theme', dark ? 'dark' : 'light') } catch { /* ignore */ }
  }, [dark])

  useEffect(() => {
    if (!isAdmin) return
    supabase.from('kb_profiles').select('id', { count: 'exact', head: true }).eq('role', 'pending')
      .then(({ count }) => setPending(count ?? 0))
  }, [isAdmin, loc.pathname])

  useEffect(() => { setMenu(null) }, [loc.pathname])
  const online = useOnline()
  useEffect(() => { if (online) refreshOffline() }, [online])

  const navCls = ({ isActive }: { isActive: boolean }) => cn(
    'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[14px] font-medium transition-colors',
    isActive ? 'bg-neutral-900/[.06] text-neutral-900 dark:bg-white/10 dark:text-white' : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white',
  )
  const editing = loc.pathname === '/novo' || loc.pathname.endsWith('/editar')

  return (
    <div className="min-h-dvh">
      <header className="no-print material hairline-b pt-safe sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link to="/" className="mr-2 flex shrink-0 items-center gap-2.5">
            <Logo />
            <span className="leading-none">
              <span className="block text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">Fields</span>
              <span className="mt-0.5 block text-[11px] font-medium text-neutral-500">Quallit Soluções em TI</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            <NavLink to="/" end className={navCls}>Biblioteca</NavLink>
            <NavLink to="/comunidade" className={navCls}>Comunidade</NavLink>
            <NavLink to="/trilhas" className={navCls}>Trilhas</NavLink>
            <NavLink to="/meus" className={navCls}>Meus</NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navCls}>
                Administração
                {pending > 0 && <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff3b30] px-1 text-[11px] font-semibold text-white">{pending}</span>}
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => openSearch()}
              className="hidden h-9 w-56 items-center gap-2 rounded-[10px] bg-neutral-900/[.06] px-3 text-[14px] text-neutral-500 transition hover:bg-neutral-900/[.09] md:flex dark:bg-white/10">
              <Search className="size-4" /><span className="flex-1 text-left">Buscar</span>
              <kbd className="text-[11px] text-neutral-400">{mac ? '⌘' : 'Ctrl'} K</kbd>
            </button>
            <button onClick={() => openSearch()} className="grid size-9 place-items-center rounded-lg text-neutral-600 md:hidden dark:text-neutral-300" aria-label="Buscar">
              <Search className="size-5" />
            </button>
            <button onClick={() => nav('/novo')}
              className="press ml-1 hidden h-9 items-center gap-1 rounded-[10px] bg-accent-600 px-3 text-[14px] font-medium text-white hover:bg-accent-700 md:inline-flex dark:bg-accent-500">
              <Plus className="size-4" strokeWidth={2.4} />Novo
            </button>

            {/* Notificações */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => (window.innerWidth < 768 ? nav('/notificacoes') : setMenu(m => m === 'notif' ? null : 'notif'))}
                className="relative grid size-9 place-items-center rounded-lg text-neutral-600 hover:bg-neutral-900/5 dark:text-neutral-300 dark:hover:bg-white/10" aria-label="Notificações">
                <Bell className="size-5" />
                {unread > 0 && <span className="absolute right-0.5 top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-semibold text-white ring-2 ring-[#f5f5f7] dark:ring-black">{unread > 99 ? '99+' : unread}</span>}
              </button>
              {menu === 'notif' && (
                <>
                  <div className="absolute right-0 top-11 z-50 w-[380px] overflow-hidden rounded-[14px] bg-white shadow-2xl ring-[0.5px] ring-black/10 pop-in dark:bg-neutral-900 dark:ring-white/10">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-[15px] font-semibold text-neutral-900 dark:text-white">Notificações</span>
                      {unread > 0 && <button onClick={() => markRead()} className="text-[13px] font-medium text-accent-600 dark:text-accent-400">Marcar todas como lidas</button>}
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto border-t border-neutral-200/70 dark:border-neutral-800"><NotificationList compact onNavigate={() => setMenu(null)} /></div>
                    <Link to="/notificacoes" className="flex items-center justify-center gap-1.5 border-t border-neutral-200/70 py-2.5 text-[13px] font-medium text-accent-600 dark:border-neutral-800 dark:text-accent-400">
                      <Settings className="size-3.5" />Ver todas e configurar
                    </Link>
                  </div>
                </>
              )}
            </div>

            <button onClick={() => setDark(d => !d)} className="hidden size-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-900/5 sm:grid dark:hover:bg-white/10" title="Alternar tema" aria-label="Alternar tema">
              {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            </button>
            <div className="relative hidden md:block" ref={accountRef}>
              <button onClick={() => setMenu(m => m === 'account' ? null : 'account')} className="ml-1 flex items-center rounded-full" aria-label="Menu da conta">
                <Avatar name={profile?.full_name} email={profile?.email} url={profile?.avatar_url} size={30} />
              </button>
              {menu === 'account' && (
                <>
                  <div className="material absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-[12px] shadow-xl ring-[0.5px] ring-black/10 pop-in dark:ring-white/10">
                    <div className="px-4 py-3">
                      <div className="truncate text-[15px] font-semibold text-neutral-900 dark:text-white">{profile?.full_name}</div>
                      <div className="truncate text-[13px] text-neutral-500">{profile?.email}</div>
                      <div className="mt-0.5 text-[12px] font-medium text-accent-600 dark:text-accent-400">{profile && ROLE_LABEL[profile.role]}</div>
                    </div>
                    <div className="hairline-t">
                      <MenuItem onClick={() => nav(`/pessoa/${profile?.id}`)} icon={<Users className="size-4" />}>Meu perfil público</MenuItem>
                      <MenuItem onClick={() => nav('/perfil')} icon={<UserRound className="size-4" />}>Conta e preferências</MenuItem>
                      <MenuItem onClick={() => { setMenu(null); signOut() }} icon={<LogOut className="size-4" />} danger>Sair</MenuItem>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {!online && (
        <div className="no-print sticky top-[calc(56px+env(safe-area-inset-top))] z-30 flex items-center justify-center gap-2 bg-neutral-800 px-4 py-2 text-[13px] text-white">
          <WifiOff className="size-4" />Sem internet · <Link to="/meus?aba=offline" className="font-semibold underline">abrir tutoriais salvos</Link>
        </div>
      )}
      <main className={cn('mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8', !editing && 'pb-tabbar')}>{children}</main>

      {/* Barra de abas inferior (celular) */}
      {!editing && (
        <nav className="no-print material hairline-t pb-safe fixed inset-x-0 bottom-0 z-40 md:hidden">
          <div className="mx-auto grid h-[56px] max-w-md grid-cols-5">
            <Tab to="/" end icon={Library} label="Biblioteca" />
            <button onClick={() => openSearch()} className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-neutral-500">
              <Search className="size-6" strokeWidth={1.8} />Buscar
            </button>
            <button onClick={() => nav('/novo')} className="press flex flex-col items-center justify-center" aria-label="Novo tutorial">
              <span className="grid size-11 place-items-center rounded-full bg-brand-orange text-white shadow-[0_4px_12px_-2px_rgb(254_129_30/0.6)]"><Plus className="size-6" strokeWidth={2.5} /></span>
            </button>
            <Tab to="/comunidade" icon={Users} label="Comunidade" />
            <Tab to="/perfil" icon={UserRound} label="Perfil" badge={isAdmin ? pending : 0} />
          </div>
        </nav>
      )}
      <SearchPalette />
    </div>
  )
}

function Tab({ to, icon: Icon, label, end, badge }: { to: string; icon: typeof Library; label: string; end?: boolean; badge?: number }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cn('relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
      isActive ? 'text-accent-600 dark:text-accent-400' : 'text-neutral-500')}>
      <Icon className="size-6" strokeWidth={1.8} />
      {label}
      {!!badge && <span className="absolute left-1/2 top-1 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-semibold text-white">{badge}</span>}
    </NavLink>
  )
}

function MenuItem({ children, icon, onClick, danger }: { children: ReactNode; icon: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-[15px] transition-colors hover:bg-neutral-900/5 dark:hover:bg-white/5',
      danger ? 'text-[#ff3b30]' : 'text-neutral-800 dark:text-neutral-200')}>
      {icon}{children}
    </button>
  )
}
