import { useEffect, useRef, useState } from 'react'
import Bg from '../../assets/bgnew.jpg'
import Logo from '../../assets/logo.png'
import Map from '../../assets/map.png'
import Mouse from '../../assets/mouse.png'
import Congdong from '../../assets/congdong.png'
import Vongquaymayman from '../../assets/vongquaymayman.png'
import Button from '../../ui/button'
import { useNavigate } from 'react-router-dom'
import {
  getUserFromStorage,
  logout,
  subscribeAuth,
  useAuth,
  type AuthUser,
} from '../../service'

const CTA_ROWS = [
  {
    key: 'map',
    label: 'Săn kho báu',
    icon: Map,
    iconAlt: 'map',
  },
  {
    key: 'chat',
    label: 'Diễn đàn học tập',
    icon: Congdong,
    iconAlt: 'community',
  },
  {
    key: 'wheel',
    label: 'Vòng quay may mắn',
    icon: Vongquaymayman,
    iconAlt: 'lucky wheel',
  },
] as const

const Home = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const menuRef = useRef<HTMLDivElement>(null)
  const cached = getUserFromStorage()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [displayName, setDisplayName] = useState(cached?.displayName || '')
  const [hasSession, setHasSession] = useState(Boolean(cached))
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const unsub = subscribeAuth((next) => {
      setUser(next)
      setHasSession(Boolean(next))

      if (!next) {
        setDisplayName('')
        setMenuOpen(false)
        return
      }

      const stored = getUserFromStorage()
      setDisplayName(
        stored?.displayName ||
          stored?.username ||
          next.displayName ||
          next.email?.split('@')[0] ||
          'Thám hiểm',
      )
    })

    return unsub
  }, [])

  useEffect(() => {
    if (!menuOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
      setMenuOpen(false)
      navigate('/')
    } finally {
      setLoggingOut(false)
    }
  }

  function handleCtaClick(key: (typeof CTA_ROWS)[number]['key']) {
    if (key === 'map') navigate('/map')
    if (key === 'wheel') navigate('/phanthuong')
    if (key === 'chat') navigate('/community')
  }

  const showUser = hasSession || Boolean(user)

  return (
    <div className="home-page">
      <div className="home-hero">
        <div
          className="home-hero__bg"
          style={{ backgroundImage: `url(${Bg})` }}
          aria-hidden="true"
        />

        <img
          className="home-hero__mascot mascot-whisker"
          src={Mouse}
          alt="Whisker mascot"
        />

        <img
          className="home-hero__logo"
          src={Logo}
          alt="Whisker"
        />

        <div className="home-hero__login">
          {showUser ? (
            <div className="user-menu" ref={menuRef}>
              <div className="user-menu__trigger">
                <Button className="btn-wood btn-wood--login btn-wood--user" disabled>
                  {displayName}
                </Button>
                <button
                  type="button"
                  className={`user-menu__arrow${menuOpen ? ' is-open' : ''}`}
                  aria-label="Mở menu tài khoản"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>

              {menuOpen && (
                <div className="user-menu__dropdown">
                  <button
                    type="button"
                    className="user-menu__item"
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    {loggingOut ? 'Đang thoát...' : 'Đăng xuất'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button
              className="btn-wood btn-wood--login"
              onClick={() => navigate('/login')}
            >
              Đăng nhập
            </Button>
          )}
        </div>

        {/* —— Khối 3 mục CTA, ngang hàng, icon trên - nút dưới, chung 1 nền pill —— */}
        <div className="home-hero__ctas-panel">
          {CTA_ROWS.map((row) => (
            <div key={row.key} className={`cta-col cta-col--${row.key}`}>
              <div className={`cta-col__icon cta-col__icon--${row.key}`}>
                <img src={row.icon} alt={row.iconAlt} />
              </div>
              <Button
                className="btn-wood btn-wood--cta"
                onClick={() => handleCtaClick(row.key)}
              >
                {row.label}
              </Button>
            </div>
          ))}
        </div>

        {/* —— Nút "Bắt đầu" riêng, nằm dưới khối 3 mục —— */}
        <Button
          className="btn-wood btn-wood--start"
          onClick={() => navigate('/map')}
        >
          Bắt đầu
        </Button>
      </div>
    </div>
  )
}

export default Home