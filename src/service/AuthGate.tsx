import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import {
  getRtdbUserProfile,
  toStoredUser,
} from './rtdb'
import {
  getUserFromStorage,
  type StoredUser,
} from './storage'
import {
  subscribeAuth,
  type AuthUser,
} from './auth'

type AuthContextValue = {
  user: AuthUser | null
  profile: StoredUser | null
  ready: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  ready: false,
  refreshProfile: async () => undefined,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<StoredUser | null>(() => getUserFromStorage())
  const [ready, setReady] = useState(false)

  const refreshProfile = useCallback(async () => {
    const uid = user?.uid
    if (!uid) {
      setProfile(null)
      return
    }
    const next = await getRtdbUserProfile(uid)
    if (next) {
      const stored = toStoredUser(next)
      setProfile(stored)
    } else {
      setProfile(getUserFromStorage())
    }
  }, [user?.uid])

  useEffect(() => {
    const unsub = subscribeAuth(async (next) => {
      setUser(next)
      if (!next) {
        setProfile(null)
        setReady(true)
        return
      }
      const remote = await getRtdbUserProfile(next.uid)
      setProfile(remote ? toStoredUser(remote) : getUserFromStorage())
      setReady(true)
    })
    return unsub
  }, [])

  const value = useMemo(
    () => ({ user, profile, ready, refreshProfile }),
    [user, profile, ready, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

function AuthLoading() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: '#1a1008',
        color: '#fff6d0',
        fontFamily: 'Nunito, sans-serif',
        fontWeight: 800,
      }}
    >
      Đang kiểm tra phiên đăng nhập...
    </div>
  )
}

/** Phải đăng nhập */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) return <AuthLoading />
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

/** Đã login + đã làm test mới được vào web */
export function RequireTestCompleted({ children }: { children: ReactNode }) {
  const { user, profile, ready } = useAuth()
  const location = useLocation()

  if (!ready) return <AuthLoading />
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (!profile?.hasCompletedTest) {
    return <Navigate to="/test" replace />
  }
  return children
}

/** Trang test: phải login, nếu đã làm rồi thì về Home */
export function RequireTestPending({ children }: { children: ReactNode }) {
  const { user, profile, ready } = useAuth()

  if (!ready) return <AuthLoading />
  if (!user) return <Navigate to="/login" replace />
  if (profile?.hasCompletedTest) return <Navigate to="/" replace />
  return children
}

/** Chỉ cho khách */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, profile, ready } = useAuth()

  if (!ready) return <AuthLoading />
  if (user) {
    return (
      <Navigate
        to={profile?.hasCompletedTest ? '/' : '/test'}
        replace
      />
    )
  }
  return children
}
