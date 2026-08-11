import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { admin } from '../../api'
import '../../styles/admin.css'

const NAV_ITEMS = [
  { path: '/admin/dashboard',    icon: 'grid-1x2-fill',              label: 'Dashboard' },
  { path: '/admin/applications', icon: 'card-checklist',             label: 'Applications' },
  { path: '/admin/reports',      icon: 'file-earmark-bar-graph-fill', label: 'Reports' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const [checking, setChecking]       = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768)
  const [timeStr, setTimeStr]         = useState('')

  useEffect(() => {
    admin.getSession()
      .then((data) => {
        if (data && data.success === true) {
          setChecking(false)
        } else {
          navigate('/admin/login', { replace: true })
        }
      })
      .catch(() => navigate('/admin/login', { replace: true }))
  }, [navigate])

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      setTimeStr(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleLogout = async () => {
    try { await admin.logout() } catch {}
    navigate('/admin/login', { replace: true })
  }

  if (checking) {
    return (
      <div className="page-loader">
        <div className="spinner-border text-danger" role="status" />
      </div>
    )
  }

  return (
    <div className="admin-layout">
      {/* Mobile backdrop */}
      <div
        className={`admin-sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="admin-sidebar-header">
          <img src="/bjp_logo.svg" alt="BJP" className="admin-logo"
            onError={(e) => { e.target.src = '/bjp_logo.png' }} />
          {sidebarOpen && (
            <div>
              <div className="admin-brand">BJP Tamil Nadu</div>
              <div className="admin-tagline">Local Body Candidate Portal</div>
            </div>
          )}
        </div>

        <nav className="admin-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `admin-nav-item${isActive ? ' active' : ''}`}
              title={!sidebarOpen ? item.label : undefined}
            >
              <i className={`bi bi-${item.icon}`} />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-logout-btn" onClick={handleLogout} title={!sidebarOpen ? 'Logout' : undefined}>
            <i className="bi bi-box-arrow-left" />
            {sidebarOpen && <span>Logout Panel</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-toggle-btn" onClick={() => setSidebarOpen((o) => !o)} aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            <i className={`bi bi-${sidebarOpen ? 'layout-sidebar-reverse' : 'layout-sidebar'}`} />
          </button>
          <div className="admin-topbar-brand">
            <span className="bjp-badge-pill">BJP TN 2026</span>
            <span>Local Body Elections Admin</span>
          </div>

          <div className="admin-topbar-right">
            <div className="admin-topbar-clock">
              <i className="bi bi-clock-history me-1" />
              <span>{timeStr}</span>
            </div>
            <div className="admin-user-badge">
              <div className="admin-avatar">
                <i className="bi bi-person-fill" />
              </div>
              <div className="admin-user-info">
                <span className="admin-name">Admin User</span>
                <span className="admin-role">Super Admin</span>
              </div>
            </div>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
