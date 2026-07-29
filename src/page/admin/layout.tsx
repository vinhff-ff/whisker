import { ConfigProvider } from 'antd'
import { Link, NavLink, Outlet } from 'react-router-dom'

const MENU = [
  { to: '/admin', end: true, label: 'Tổng quan' },
  { to: '/admin/users', end: false, label: 'Người dùng' },
  { to: '/admin/content', end: false, label: 'Nội dung' },
  { to: '/admin/rewards', end: false, label: 'Phần thưởng' },
  { to: '/admin/settings', end: false, label: 'Cài đặt' },
] as const

const AdminLayout = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 2,
          borderRadiusLG: 2,
          borderRadiusSM: 2,
          borderRadiusXS: 2,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        },
        components: {
          Button: {
            borderRadius: 2,
            borderRadiusLG: 2,
            borderRadiusSM: 2,
          },
          Drawer: {
            borderRadiusLG: 2,
          },
          Modal: {
            borderRadiusLG: 2,
          },
          Input: {
            borderRadius: 2,
          },
        },
      }}
    >
      <div className="admin-layout">
        <aside className="admin-layout__sidebar">
          <div className="admin-layout__brand">
            <span className="admin-layout__brand-mark">W</span>
            <div className="admin-layout__brand-text">
              <strong>Whisker</strong>
              <span>Admin</span>
            </div>
          </div>

          <nav className="admin-layout__nav" aria-label="Admin menu">
            {MENU.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `admin-layout__link${isActive ? ' is-active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <Link className="admin-layout__back" to="/">
            ← Về trang chủ
          </Link>
        </aside>

        <main className="admin-layout__content">
          <Outlet />
        </main>
      </div>
    </ConfigProvider>
  )
}

export default AdminLayout
