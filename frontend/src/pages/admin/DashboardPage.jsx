import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { admin } from '../../api'
import '../../styles/admin.css'

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div className="stat-card" style={{ '--sc-color': color, '--sc-bg': bg }}>
      <div className="stat-card-icon"><i className={`bi bi-${icon}`} /></div>
      <div className="stat-card-value">{value ?? '—'}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([admin.getStats(), admin.getApplications({ page: 1, page_size: 5 })])
      .then(([s, r]) => {
        if (s.status === 'fulfilled') setStats(s.value)
        if (r.status === 'fulfilled') setRecent(r.value.applications || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const s = stats || {}

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <div className="spinner-border text-danger" role="status" />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1><i className="bi bi-grid-1x2-fill me-2 text-coral" />Dashboard</h1>
        <p>Local Body Candidate Applications — overview</p>
      </div>

      <div className="stat-cards-grid">
        <StatCard icon="card-checklist"  label="Total Applications" value={s.total} color="#E53935" bg="rgba(229,57,53,0.12)" />
        <StatCard icon="calendar-check"  label="Today"              value={s.today} color="#6a1b9a" bg="rgba(106,27,154,0.12)" />
        <StatCard icon="tree-fill"       label="Rural"              value={s.rural} color="#43a047" bg="rgba(46,125,50,0.12)" />
        <StatCard icon="building-fill"   label="Urban"              value={s.urban} color="#1565c0" bg="rgba(21,101,192,0.12)" />
      </div>

      <div className="admin-card" style={{ marginTop: 24 }}>
        <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h6 className="admin-card-title"><i className="bi bi-clock-history text-coral" /> Recent Applications</h6>
          <button
            onClick={() => navigate('/admin/applications')}
            style={{ background: 'none', border: 'none', color: 'var(--color-harvest-flame, #f26522)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
          >
            View all <i className="bi bi-arrow-right" />
          </button>
        </div>

        {recent.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--admin-ink-dim)', fontSize: 13 }}>
            No applications yet.
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Application ID</th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Type</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.application_id} style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/admin/applications/${a.application_id}`)}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.application_id}</td>
                    <td>{a.voter?.name || '—'}</td>
                    <td>{a.mobile}</td>
                    <td style={{ textTransform: 'capitalize' }}>{a.body_type}</td>
                    <td>{a.submitted_at ? new Date(a.submitted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
