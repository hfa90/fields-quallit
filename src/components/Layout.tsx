import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Plus, ShieldCheck, LogOut, Moon, Sun, UserRound, Library, FileText } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { ROLE_LABEL, cn } from '../lib/utils'
import { Avatar } from './ui'

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[9px] bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" style={{ width: size, height: size }}>
      <BookOpen style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.2} />
    </span>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [menu, setMenu] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [pending, setPending] = useState(0)

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

  const navCls = ({ isActive }: { isActive: boolean }) => cn(
    'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[14px] font-medium transition-colors',
    isActive ? 'bg-neutral-900/[.06] text-neutral-900 dark:bg-white/10 dark:text-white' : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white',
  )

  const editing = loc.pathname === '/novo' || loc.pathname.endsWith('/editar')

  return (
    <div className="min-h-dvh">
      <header className="no-print material hairline-b pt-safe sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link to="/" className="mr-3 flex items-center gap-2.5">
            <Logo />
            <span className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">Fields Quallit</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={navCls}>Biblioteca</NavLink>
            <NavLink to="/meus" className={navCls}>Meus tutoriais</NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navCls}>
                Administração
                {pending > 0 && <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff3b30] px-1 text-[11px] font-semibold text-white">{pending}</span>}
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => nav('/novo')}
              className="press hidden h-8 items-center gap-1 rounded-lg bg-accent-600 px-3 text-[14px] font-medium text-white hover:bg-accent-700 md:inline-flex dark:bg-accent-500">
              <Plus className="size-4" strokeWidth={2.4} />Novo tutorial
            </button>
            <button onClick={() => setDark(d => !d)} className="grid size-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-900/5 dark:hover:bg-white/10" title="Alternar tema" aria-label="Alternar tema">
              {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            </button>
            <div className="relative hidden md:block">
              <button onClick={() => setMenu(m => !m)} className="ml-1 flex items-center rounded-full" aria-label="Menu da conta">
                <Avatar name={profile?.full_name} email={profile?.email} url={profile?.avatar_url} size={30} />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                  <div className="material absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-[12px] shadow-xl ring-[0.5px] ring-black/10 pop-in dark:ring-white/10">
                    <div className="px-4 py-3">
                      <div className="truncate text-[15px] font-semibold text-neutral-900 dark:text-white">{profile?.full_name}</div>
                      <div className="truncate text-[13px] text-neutral-500">{profile?.email}</div>
                      <div className="mt-0.5 text-[12px] font-medium text-accent-600 dark:text-accent-400">{profile && ROLE_LABEL[profile.role]}</div>
                    </div>
                    <div className="hairline-t">
                      <MenuItem onClick={() => { setMenu(false); nav('/perfil') }} icon={<UserRound className="size-4" />}>Meu perfil</MenuItem>
                      <MenuItem onClick={() => { setMenu(false); signOut() }} icon={<LogOut className="size-4" />} danger>Sair</MenuItem>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className={cn('mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8', !editing && 'pb-tabbar')}>{children}</main>

      {/* Barra de abas inferior (celular) */}
      {!editing && (
        <nav className="no-print material hairline-t pb-safe fixed inset-x-0 bottom-0 z-40 md:hidden">
          <div className="mx-auto grid h-[56px] max-w-md" style={{ gridTemplateColumns: `repeat(${isAdmin ? 5 : 4}, 1fr)` }}>
            <Tab to="/" end icon={Library} label="Biblioteca" />
            <Tab to="/meus" icon={FileText} label="Meus" />
            <button onClick={() => nav('/novo')} className="press flex flex-col items-center justify-center" aria-label="Novo tutorial">
              <span className="grid size-10 place-items-center rounded-full bg-accent-600 text-white shadow-sm dark:bg-accent-500"><Plus className="size-5" strokeWidth={2.5} /></span>
            </button>
            {isAdmin && <Tab to="/admin" icon={ShieldCheck} label="Admin" badge={pending} />}
            <Tab to="/perfil" icon={UserRound} label="Perfil" />
          </div>
        </nav>
      )}
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
