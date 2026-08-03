import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../../assets/logo.png'
import BgLogin from '../../assets/bglogin.mp4'
import Papper from '../../assets/papper.png'
import Button from '../../ui/button'
import useAuthForm, { type AuthMode } from './hook'

interface AuthPageProps {
  initialMode?: AuthMode
}

const AuthPage = ({ initialMode = 'login' }: AuthPageProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  // Chỉ hiển thị UI, không lưu khi đăng ký
  const [gender, setGender] = useState<'nam' | 'nu' | 'khac'>('nam')
  const {
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
    switchMode,
    submit,
  } = useAuthForm(initialMode)

  function handleMuteToggle() {
    if (!videoRef.current) return
    videoRef.current.muted = !muted
    setMuted((v) => !v)
  }

  return (
    <div className="auth-page">
      <video
        ref={videoRef}
        className="auth-page__video"
        autoPlay
        loop
        playsInline
        muted
        preload="auto"
      >
        <source src={BgLogin} type="video/mp4" />
      </video>
      <div className="auth-page__veil" aria-hidden="true" />

      <Link to="/" className="auth-page__brand">
        <img src={Logo} alt="Whisker" />
      </Link>

      <button
        type="button"
        className="auth-page__mute"
        onClick={handleMuteToggle}
        title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
      >
        {muted ? 'Bật âm' : 'Tắt âm'}
      </button>

      <div className="auth-page__panel-wrap">
        <div
          className="auth-page__panel"
          style={{ backgroundImage: `url(${Papper})` }}
        >
          <div className="auth-page__panel-inner">
            <p className="auth-page__eyebrow">Whisker Adventure</p>
            <h1 className="auth-page__title">
              {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </h1>
            <p className="auth-page__subtitle">
              {mode === 'login'
                ? 'Tiếp tục hành trình tìm kho báu trong hang động.'
                : 'Gia nhập đội thám hiểm và bắt đầu cuộc phiêu lưu.'}
            </p>

            <form className="auth-page__form" onSubmit={submit}>
              <label className="auth-field">
                <span className="auth-field__label">Tài khoản</span>
                <div className="auth-field__control">
                  <span className="auth-field__icon" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Tên thám hiểm"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
              </label>

              <label className="auth-field">
                <span className="auth-field__label">Mật khẩu</span>
                <div className="auth-field__control">
                  <span className="auth-field__icon" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    className="auth-field__toggle"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPass ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </label>

              {mode === 'register' && (
                <label className="auth-field">
                  <span className="auth-field__label">Xác nhận mật khẩu</span>
                  <div className="auth-field__control">
                    <span className="auth-field__icon" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <input
                      type="password"
                      placeholder="Nhập lại mật khẩu"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </label>
              )}

              {mode === 'register' && (
                <fieldset className="auth-field auth-gender">
                  <legend className="auth-field__label">Giới tính</legend>
                  <div className="auth-gender__options" role="radiogroup" aria-label="Giới tính">
                    {(
                      [
                        { value: 'nam', label: 'Nam' },
                        { value: 'nu', label: 'Nữ' },
                        { value: 'khac', label: 'Khác' },
                      ] as const
                    ).map((opt) => (
                      <label key={opt.value} className="auth-gender__option">
                        <input
                          type="radio"
                          name="gender"
                          value={opt.value}
                          checked={gender === opt.value}
                          onChange={() => setGender(opt.value)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {error && <div className="auth-page__error">{error}</div>}

              <Button
                type="submit"
                className="btn-wood auth-page__submit"
                disabled={loading}
              >
                {loading
                  ? 'Đang xử lý...'
                  : mode === 'login'
                    ? 'Đăng nhập'
                    : 'Tạo tài khoản'}
              </Button>
            </form>

            <p className="auth-page__switch">
              {mode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
              <button
                type="button"
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? 'Đăng ký miễn phí' : 'Đăng nhập ngay'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthPage
