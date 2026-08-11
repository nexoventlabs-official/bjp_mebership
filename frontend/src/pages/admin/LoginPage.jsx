import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { admin } from '../../api'
import '../../styles/admin.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!username.trim() || !password) {
      setError('Enter your username and password.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await admin.login(username.trim(), password)
      if (data && data.success === true) {
        navigate('/admin/dashboard', { replace: true })
      } else {
        setError(data?.message || 'Invalid username or password.')
      }
    } catch (err) {
      setError(err?.message || 'Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-wrap">
      <div className="admin-login-card">
        <div className="admin-login-logo">
          <img src="/bjp_logo.svg" alt="BJP" onError={(e) => { e.target.src = '/bjp_logo.png' }} />
        </div>
        <div className="admin-login-title">BJP Tamil Nadu</div>
        <div className="admin-login-subtitle">Admin Panel — Sign In</div>

        <form onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label htmlFor="admin-username" className="admin-form-label">Username</label>
            <input
              id="admin-username"
              className="admin-form-control"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="admin-password" className="admin-form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="admin-password"
                className="admin-form-control"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                disabled={loading}
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--admin-ink-dim)', cursor: 'pointer', fontSize: 16, display: 'flex' }}
              >
                <i className={`bi bi-${showPass ? 'eye-slash' : 'eye'}`} />
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" style={{ background: 'rgba(242,101,34,0.06)', border: '1px solid rgba(242,101,34,0.2)', borderRadius: 'var(--radius-buttons)', padding: '9px 12px', fontSize: 13, color: 'var(--color-harvest-flame)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
              <i className="bi bi-exclamation-circle" /> {error}
            </div>
          )}

          <button className="admin-login-btn" type="submit" disabled={loading}>
            {loading
              ? <><span className="spinner-border spinner-border-sm me-2" /> Signing in…</>
              : <><i className="bi bi-box-arrow-in-right me-2" />Sign In</>
            }
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-secondary)' }}>
          <i className="bi bi-lock" /> Authorized admins only
        </p>
      </div>
    </div>
  )
}
