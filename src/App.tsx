import { lazy, Suspense, useCallback } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { NotificationsProvider } from './lib/notifications'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import { InstallPrompt } from './components/InstallApp'
import Login from './pages/Login'
import Pending from './pages/Pending'
import ResetPassword from './pages/ResetPassword'
import Home from './pages/Home'
import TutorialView from './pages/TutorialView'
import NotFound from './pages/NotFound'

// Telas pesadas ou menos usadas carregam sob demanda
const TutorialEdit = lazy(() => import('./pages/TutorialEdit'))
const Admin = lazy(() => import('./pages/Admin'))
const ProfilePage = lazy(() => import('./pages/Profile'))
const MyLibrary = lazy(() => import('./pages/MyLibrary'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const NotificationsPage = lazy(() => import('./pages/Notifications'))
const Community = lazy(() => import('./pages/Community'))
const RequestPage = lazy(() => import('./pages/RequestPage'))
const PersonPage = lazy(() => import('./pages/PersonPage'))

export default function App() {
  return (
    <>
      <Gate />
      <InstallPrompt />
    </>
  )
}

function Gate() {
  const { session, profile, loading, isMember, isAdmin, recovering } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const openLink = useCallback((link: string) => nav(link.split('#')[0], { state: { inApp: true } }), [nav])

  if (loading) return <div className="grid min-h-dvh place-items-center"><Spinner /></div>
  if (recovering) return <ResetPassword />
  if (!session) {
    if (loc.pathname !== '/login') return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search + loc.hash }} />
    return <Routes><Route path="/login" element={<Login />} /></Routes>
  }
  if (!profile) return <div className="grid min-h-dvh place-items-center"><Spinner label="Preparando seu perfil…" /></div>
  if (!isMember) return <Pending />

  const from = (loc.state as { from?: string } | null)?.from
  return (
    <NotificationsProvider onOpen={openLink}>
      <Layout>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/login" element={<Navigate to={from && from !== '/login' ? from : '/'} replace />} />
            <Route path="/" element={<Home />} />
            <Route path="/meus" element={<MyLibrary />} />
            <Route path="/busca" element={<SearchPage />} />
            <Route path="/notificacoes" element={<NotificationsPage />} />
            <Route path="/comunidade" element={<Community />} />
            <Route path="/comunidade/pedido/:id" element={<RequestPage />} />
            <Route path="/pessoa/:id" element={<PersonPage />} />
            <Route path="/novo" element={<TutorialEdit />} />
            <Route path="/t/:code" element={<TutorialView />} />
            <Route path="/t/:code/editar" element={<TutorialEdit />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </NotificationsProvider>
  )
}
