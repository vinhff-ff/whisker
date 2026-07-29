import { Routes, Route, useLocation } from 'react-router-dom'
import './style/index.scss'
import Home from './page/home'
import Login from './page/login/login'
import Register from './page/login/register'
import TestPage from './page/test'
import AdminLayout from './page/admin/layout'
import AdminDashboard from './page/admin'
import AdminUsers from './page/admin/users'
import AdminContent from './page/admin/content'
import AdminRewards from './page/admin/rewards'
import AdminSettings from './page/admin/settings'
import MapPage from './page/map'
import PhanthuongPage from './page/phanthuong'
import CommunityPage from './page/community/CommunityPage'
import Chatbot from './page/chatbot'
import {
  AuthProvider,
  GuestOnly,
  RequireAuth,
  RequireTestCompleted,
  RequireTestPending,
  useAuth,
} from './service/AuthGate'

function AppChatbot() {
  const { user, profile, ready } = useAuth()
  const { pathname } = useLocation()

  if (!ready || !user || !profile?.hasCompletedTest) return null
  if (
    pathname.startsWith('/admin') ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/test'
  ) {
    return null
  }

  return <Chatbot />
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/"
          element={
            <RequireTestCompleted>
              <Home />
            </RequireTestCompleted>
          }
        />
        <Route
          path="/map"
          element={
            <RequireTestCompleted>
              <MapPage />
            </RequireTestCompleted>
          }
        />
        <Route
          path="/phanthuong"
          element={
            <RequireTestCompleted>
              <PhanthuongPage />
            </RequireTestCompleted>
          }
        />
        <Route
          path="/community"
          element={
            <RequireTestCompleted>
              <CommunityPage />
            </RequireTestCompleted>
          }
        />
        <Route
          path="/test"
          element={
            <RequireTestPending>
              <TestPage />
            </RequireTestPending>
          }
        />
        <Route
          path="/login"
          element={
            <GuestOnly>
              <Login />
            </GuestOnly>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnly>
              <Register />
            </GuestOnly>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="rewards" element={<AdminRewards />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
        <Route
          path="*"
          element={
            <RequireTestCompleted>
              <Home />
            </RequireTestCompleted>
          }
        />
      </Routes>
      <AppChatbot />
    </AuthProvider>
  )
}

export default App
