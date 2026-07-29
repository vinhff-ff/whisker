import { useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  loginWithUsername,
  mapAuthError,
  registerWithUsername,
} from '../../../service'

export type AuthMode = 'login' | 'register'

export type AuthFormValues = {
  username: string
  password: string
  confirm: string
}

export type AuthValidationResult = {
  ok: boolean
  message?: string
}

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,24}$/

/** Validate form before calling Firebase */
export function checkAuthForm(
  mode: AuthMode,
  values: AuthFormValues,
): AuthValidationResult {
  const username = values.username.trim()
  const password = values.password
  const confirm = values.confirm

  if (!username) {
    return { ok: false, message: 'Vui lòng nhập tài khoản.' }
  }

  if (!USERNAME_RE.test(username) && !username.includes('@')) {
    return {
      ok: false,
      message: 'Tài khoản 3–24 ký tự (chữ, số, . _ -).',
    }
  }

  if (!password) {
    return { ok: false, message: 'Vui lòng nhập mật khẩu.' }
  }

  if (password.length < 6) {
    return { ok: false, message: 'Mật khẩu cần ít nhất 6 ký tự.' }
  }

  if (mode === 'register') {
    if (!confirm) {
      return { ok: false, message: 'Vui lòng xác nhận mật khẩu.' }
    }
    if (password !== confirm) {
      return { ok: false, message: 'Mật khẩu xác nhận không khớp.' }
    }
  }

  return { ok: true }
}

export function useAuthForm(initialMode: AuthMode = 'login') {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const switchMode = useCallback((next: AuthMode) => {
    setMode(next)
    setError('')
    setUsername('')
    setPassword('')
    setConfirm('')
    setShowPass(false)
  }, [])

  const submit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      setError('')

      const check = checkAuthForm(mode, { username, password, confirm })
      if (!check.ok) {
        setError(check.message || 'Dữ liệu không hợp lệ.')
        return false
      }

      setLoading(true)
      try {
        if (mode === 'login') {
          await loginWithUsername(username, password)
        } else {
          await registerWithUsername(username, password)
        }
        const redirectTo =
          (location.state as { from?: string } | null)?.from || '/'
        navigate(redirectTo, { replace: true })
        return true
      } catch (err) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code?: string }).code)
            : undefined

        if (code === 'USERNAME_TAKEN') {
          setError('Tên thám hiểm đã được sử dụng.')
        } else {
          setError(
            mapAuthError(
              code,
              mode === 'login'
                ? 'Sai tài khoản hoặc mật khẩu.'
                : 'Đăng ký thất bại. Vui lòng thử lại.',
            ),
          )
        }
        return false
      } finally {
        setLoading(false)
      }
    },
    [mode, username, password, confirm, navigate, location.state],
  )

  return {
    mode,
    username,
    password,
    confirm,
    showPass,
    loading,
    error,
    setUsername,
    setPassword,
    setConfirm,
    setShowPass,
    setError,
    switchMode,
    submit,
    check: () => checkAuthForm(mode, { username, password, confirm }),
  }
}

export default useAuthForm
