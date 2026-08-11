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

const RURAL_COLOR = '#43a047'
const URBAN_COLOR = '#1565c0'

// Rural vs Urban — donut + legend
function RuralUrbanChart({ rural = 0, urban = 0 }) {
  const total = rural + urban
  const ruralPct = total ? Math.round((rural / total) * 100) : 0
  const urbanPct = total ? 100 - ruralPct : 0
  const gradient = total
    ? `conic-gradient(${RURAL_COLOR} 0 ${ruralPct}%, ${URBAN_COLOR} ${ruralPct}% 100%)`
    : 'conic-gradient(#e0e0e0 0 100%)'

  const LegendRow = ({ color, label, count, pct }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <span style={{ width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 600, minWidth: 56 }}>{label}</span>
      <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{count} ({pct}%)</span>
    </div>
  )

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h6 className="admin-card-title"><i className="bi bi-pie-chart-fill text-coral" /> Rural vs Urban</h6>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: gradient }} />
          <div style={{ position: 'absolute', inset: 0, margin: 'auto', width: 92, height: 92, borderRadius: '50%', background: 'var(--bg-surface, #fff)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 0 1px var(--border-dim, rgba(0,0,0,0.06))' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{total}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total</div>
          </div>
        </div>
        <div>
          <LegendRow color={RURAL_COLOR} label="Rural" count={rural} pct={ruralPct} />
          <LegendRow color={URBAN_COLOR} label="Urban" count={urban} pct={urbanPct} />
        </div>
      </div>
      {total === 0 && (
        <div style={{ textAlign: 'center', paddingBottom: 16, fontSize: 12, color: 'var(--admin-ink-dim)' }}>No applications yet.</div>
      )}
    </div>
  )
}

// Top 10 assemblies — horizontal bars
function TopAssembliesChart({ data = [] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h6 className="admin-card-title"><i className="bi bi-bar-chart-fill text-coral" /> Top 10 Assemblies by Applications</h6>
      </div>
      <div style={{ padding: '12px 20px 18px' }}>
        {data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, fontSize: 12, color: 'var(--admin-ink-dim)' }}>No applications yet.</div>
        ) : (
          data.map((d, i) => {
            const pct = Math.round((d.count / max) * 100)
            const label = d.assembly_name ? d.assembly_name : `AC ${d.assembly_no}`
            return (
              <div key={d.assembly_no ?? i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12.5 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75%' }} title={`${label} (AC ${d.assembly_no})`}>
                    <span style={{ color: 'var(--admin-ink-dim)', marginRight: 6 }}>{i + 1}.</span>{label}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{d.count}</span>
                </div>
                <div style={{ height: 10, borderRadius: 6, background: 'var(--border-dim, rgba(0,0,0,0.06))', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 6, background: 'linear-gradient(90deg, #f26522, #E53935)', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )
          })
        )}
      </div>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginTop: 24 }}>
        <RuralUrbanChart rural={s.rural || 0} urban={s.urban || 0} />
        <TopAssembliesChart data={s.topAssemblies || []} />
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
