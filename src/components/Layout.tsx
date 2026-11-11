import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { BookOpen, Plus, ShieldCheck, LogOut, Moon, Sun, UserRound, Library, FileText } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { ROLE_LABEL, cn } from '../lib/utils'
import { Avatar } from './ui'

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth()
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [pending, setPending] = useState(0)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('fq-theme', dark ? 'dark' : 'light') } catch { /* ignore */ }
  }, [dark])

  useEffect(() => {
    if (!isAdmin) return
    supabase.from('kb_profiles').select('id', { count: 'exact', head: true }).eq('role', 'pending')
      .then(({ count }) => setPending(count ?? 0))
  }, [isAdmin])

  const navCls = ({ isActive }: { isActive: boolean }) => cn(
    'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
  )

  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 mr-2">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-lg shadow-indigo-500/25">
              <BookOpen className="size-5" />
            </span>
            <span className="hidden sm:block leading-tight">
              <span className="block font-bold text-slate-900 dark:text-white">Fields Quallit</span>
              <span className="block text-[11px] font-medium text-slate-500">Central de Tutoriais</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/" end className={navCls}><Library className="size-4" />Biblioteca</NavLink>
            <NavLink to="/meus" className={navCls}><FileText className="size-4" />Meus tutoriais</NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navCls}>
                <ShieldCheck className="size-4" />Administração
                {pending > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">{pending}</span>}
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => nav('/novo')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-500">
              <Plus className="size-4" /><span className="hidden sm:inline">Novo tutorial</span>
            </button>
            <button onClick={() => setDark(d => !d)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Alternar tema">
              {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
            <div className="relative">
              <button onClick={() => setMenu(m => !m)} className="flex items-center rounded-full ring-2 ring-transparent hover:ring-indigo-200 dark:hover:ring-indigo-500/30 transition">
                <Avatar name={profile?.full_name} email={profile?.email} url={profile?.avatar_url} size={36} />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900 pop-in">
                    <div className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">{profile?.full_name}</div>
                      <div className="text-xs text-slate-500 truncate">{profile?.email}</div>
                      <div className="mt-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">{profile && ROLE_LABEL[profile.role]}</div>
                    </div>
                    <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                    <MenuItem onClick={() => { setMenu(false); nav('/perfil') }} icon={<UserRound className="size-4" />}>Meu perfil</MenuItem>
                    <div className="md:hidden">
                      <MenuItem onClick={() => { setMenu(false); nav('/') }} icon={<Library className="size-4" />}>Biblioteca</MenuItem>
                      <MenuItem onClick={() => { setMenu(false); nav('/meus') }} icon={<FileText className="size-4" />}>Meus tutoriais</MenuItem>
                      {isAdmin && <MenuItem onClick={() => { setMenu(false); nav('/admin') }} icon={<ShieldCheck className="size-4" />}>Administração {pending > 0 && `(${pending})`}</MenuItem>}
                    </div>
                    <MenuItem onClick={() => { setMenu(false); signOut() }} icon={<LogOut className="size-4" />} danger>Sair</MenuItem>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}

function MenuItem({ children, icon, onClick, danger }: { children: ReactNode; icon: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800',
      danger ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300')}>
      {icon}{children}
    </button>
  )
}
