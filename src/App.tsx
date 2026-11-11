import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import Pending from './pages/Pending'
import ResetPassword from './pages/ResetPassword'
import Home from './pages/Home'
import TutorialView from './pages/TutorialView'
import NotFound from './pages/NotFound'

// O editor é pesado: carrega sob demanda
const TutorialEdit = lazy(() => import('./pages/TutorialEdit'))
const Admin = lazy(() => import('./pages/Admin'))
const ProfilePage = lazy(() => import('./pages/Profile'))

export default function App() {
  const { session, profile, loading, isMember, isAdmin, recovering } = useAuth()
  const loc = useLocation()

  if (loading) return <div className="min-h-dvh grid place-items-center"><Spinner label="Carregando…" /></div>
  if (recovering) return <ResetPassword />
  if (!session) {
    if (loc.pathname !== '/login') return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
    return <Routes><Route path="/login" element={<Login />} /></Routes>
  }
  if (!profile) return <div className="min-h-dvh grid place-items-center"><Spinner label="Preparando seu perfil…" /></div>
  if (!isMember) return <Pending />

  const from = (loc.state as { from?: string } | null)?.from
  return (
    <Layout>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/login" element={<Navigate to={from && from !== '/login' ? from : '/'} replace />} />
          <Route path="/" element={<Home />} />
          <Route path="/meus" element={<Home mine />} />
          <Route path="/novo" element={<TutorialEdit />} />
          <Route path="/t/:code" element={<TutorialView />} />
          <Route path="/t/:code/editar" element={<TutorialEdit />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
