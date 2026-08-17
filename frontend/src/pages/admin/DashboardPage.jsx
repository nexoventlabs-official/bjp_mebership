import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { admin } from '../../api'
import '../../styles/admin.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
)

function StatCard({ icon, label, value, color, bg, subtitle }) {
  return (
    <div className="stat-card" style={{ '--sc-color': color, '--sc-bg': bg }}>
      <div className="stat-card-top">
        <div className="stat-card-icon" style={{ backgroundColor: bg, color }}>
          <i className={`bi bi-${icon}`} />
        </div>
        {subtitle && <span className="stat-card-badge">{subtitle}</span>}
      </div>
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
    Promise.allSettled([admin.getStats(), admin.getApplications({ page: 1, page_size: 6 })])
      .then(([s, r]) => {
        if (s.status === 'fulfilled') setStats(s.value)
        if (r.status === 'fulfilled') setRecent(r.value.applications || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const s = stats || {}

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="spinner-border text-warning" role="status" style={{ width: '3rem', height: '3rem' }} />
      </div>
    )
  }

  // Doughnut Chart Data (Rural vs Urban)
  const ruralCount = s.rural || 0
  const urbanCount = s.urban || 0
  const totalCount = s.total || (ruralCount + urbanCount)

  const doughnutData = {
    labels: ['Rural Candidates', 'Urban Candidates'],
    datasets: [
      {
        data: [ruralCount, urbanCount],
        backgroundColor: ['#02a14d', '#f76201'],
        hoverBackgroundColor: ['#02823e', '#e05500'],
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          font: { family: 'Inter', size: 12, weight: '600' },
          padding: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const val = context.raw || 0
            const pct = totalCount ? Math.round((val / totalCount) * 100) : 0
            return ` ${context.label}: ${val} (${pct}%)`
          },
        },
      },
    },
  }

  // Bar Chart Data (Top Assemblies)
  const topAssemblies = s.topAssemblies || []
  const barLabels = topAssemblies.length
    ? topAssemblies.map((d) => d.assembly_name || `AC ${d.assembly_no}`)
    : ['Chennai', 'Coimbatore', 'Madurai', 'Trichy', 'Salem', 'Tirunelveli']
  const barValues = topAssemblies.length
    ? topAssemblies.map((d) => d.count)
    : [0, 0, 0, 0, 0, 0]

  const barData = {
    labels: barLabels,
    datasets: [
      {
        label: 'Applications',
        data: barValues,
        backgroundColor: 'rgba(247, 98, 1, 0.85)',
        hoverBackgroundColor: '#f76201',
        borderRadius: 8,
        barThickness: 24,
      },
    ],
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1a1a',
        titleFont: { size: 13, weight: '700' },
        bodyFont: { size: 12 },
        padding: 10,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Inter', size: 11, weight: '600' } },
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { precision: 0, font: { family: 'Inter', size: 11 } },
        beginAtZero: true,
      },
    },
  }

  return (
    <div className="admin-dashboard-view">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <i className="bi bi-grid-1x2-fill me-2 text-saffron" />
            Candidate Applications Dashboard
          </h1>
          <p>Real-time analytics and application statistics for BJP Local Body Candidates 2026</p>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="stat-cards-grid">
        <StatCard
          icon="card-checklist"
          label="Total Applications"
          value={s.total}
          color="#f76201"
          bg="rgba(247, 98, 1, 0.12)"
          subtitle="Total Received"
        />
        <StatCard
          icon="calendar-check-fill"
          label="Today's Applicants"
          value={s.today}
          color="#8b5cf6"
          bg="rgba(139, 92, 246, 0.12)"
          subtitle="24h Activity"
        />
        <StatCard
          icon="tree-fill"
          label="Rural Panchayat"
          value={s.rural}
          color="#02a14d"
          bg="rgba(2, 161, 77, 0.12)"
          subtitle="Union / Village"
        />
        <StatCard
          icon="building-fill"
          label="Urban Body"
          value={s.urban}
          color="#2563eb"
          bg="rgba(37, 99, 235, 0.12)"
          subtitle="Corporation / Municipality"
        />
      </div>

      {/* Voter DB (DB1) Analytics Cards */}
      <div style={{ marginTop: 24, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f76201', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="bi bi-database-fill-check" /> Tamil Nadu Voter Roll Database (DB1) — 233 Assembly Constituencies
        </div>
        <div className="stat-cards-grid">
          <StatCard
            icon="people-fill"
            label="Total Voters (DB1)"
            value="5.65 Crore"
            color="#0ea5e9"
            bg="rgba(14, 165, 233, 0.12)"
            subtitle="56,496,752 Total"
          />
          <StatCard
            icon="gender-male"
            label="Male Voters"
            value="2.80 Crore"
            color="#2563eb"
            bg="rgba(37, 99, 235, 0.12)"
            subtitle="27,954,120 (49.5%)"
          />
          <StatCard
            icon="gender-female"
            label="Female Voters"
            value="2.85 Crore"
            color="#ec4899"
            bg="rgba(236, 72, 153, 0.12)"
            subtitle="28,532,150 (50.5%)"
          />
          <StatCard
            icon="person-arms-up"
            label="Third Gender / Other"
            value="10,482"
            color="#a855f7"
            bg="rgba(168, 85, 247, 0.12)"
            subtitle="10,482 (0.02%)"
          />
        </div>
      </div>

      {/* Master Ward Data DB (DB2) Analytics Cards — All 6 Excel Datasets */}
      <div style={{ marginTop: 24, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#02a14d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="bi bi-diagram-3-fill" /> Tamil Nadu Local Body & Ward Master Database (DB2) — 6 Excel Master Files
        </div>
        <div className="stat-cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <StatCard
            icon="building-fill"
            label="1. Municipal Corporations"
            value="25 Corps"
            color="#f59e0b"
            bg="rgba(245, 158, 11, 0.12)"
            subtitle="1,566 Wards"
          />
          <StatCard
            icon="buildings-fill"
            label="2. Municipalities"
            value="162 Munis"
            color="#2563eb"
            bg="rgba(37, 99, 235, 0.12)"
            subtitle="162 Municipalities"
          />
          <StatCard
            icon="houses-fill"
            label="3. Town Panchayats"
            value="458 TPs"
            color="#6366f1"
            bg="rgba(99, 102, 241, 0.12)"
            subtitle="458 Town Panchayats"
          />
          <StatCard
            icon="award-fill"
            label="4. District Panchayat Wards"
            value="36 Districts"
            color="#8b5cf6"
            bg="rgba(139, 92, 246, 0.12)"
            subtitle="36 Rural Districts"
          />
          <StatCard
            icon="diagram-2-fill"
            label="5. Panchayat Unions"
            value="388 Unions"
            color="#06b6d4"
            bg="rgba(6, 182, 212, 0.12)"
            subtitle="388 Blocks / Unions"
          />
          <StatCard
            icon="tree-fill"
            label="6. Grama Panchayats"
            value="12,525 VPs"
            color="#02a14d"
            bg="rgba(2, 161, 77, 0.12)"
            subtitle="12,525 Village Panchayats"
          />
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="dashboard-charts-grid">
        {/* Doughnut Chart */}
        <div className="admin-card chart-card">
          <div className="admin-card-header">
            <h6 className="admin-card-title">
              <i className="bi bi-pie-chart-fill text-saffron" /> Rural vs Urban Distribution
            </h6>
          </div>
          <div className="chart-container" style={{ position: 'relative', height: 260, padding: 16 }}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
            <div className="chart-center-overlay">
              <span className="count">{totalCount}</span>
              <span className="label">Total</span>
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="admin-card chart-card">
          <div className="admin-card-header">
            <h6 className="admin-card-title">
              <i className="bi bi-bar-chart-line-fill text-saffron" /> Top Assemblies by Applications
            </h6>
          </div>
          <div className="chart-container" style={{ height: 260, padding: 16 }}>
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* Recent Applications Table */}
      <div className="admin-card" style={{ marginTop: 24 }}>
        <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h6 className="admin-card-title">
            <i className="bi bi-clock-history text-saffron" /> Recent Applications
          </h6>
          <button
            type="button"
            className="btn-view-all"
            onClick={() => navigate('/admin/applications')}
          >
            View All Registry <i className="bi bi-arrow-right" />
          </button>
        </div>

        {recent.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--admin-ink-dim)', fontSize: 13 }}>
            <i className="bi bi-inbox" style={{ fontSize: 36, display: 'block', marginBottom: 8, opacity: 0.5 }} />
            No application submissions recorded yet.
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Application ID</th>
                  <th>Candidate Name</th>
                  <th>Mobile Number</th>
                  <th>Body Type</th>
                  <th>District / Ward</th>
                  <th>Submitted Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr
                    key={a.application_id}
                    className="table-row-hover"
                    onClick={() => navigate(`/admin/applications/${a.application_id}`)}
                  >
                    <td>
                      <span className="app-id-pill">{a.application_id}</span>
                    </td>
                    <td className="fw-bold">{a.voter?.name || '—'}</td>
                    <td>{a.mobile}</td>
                    <td>
                      <span className={`body-type-badge ${a.body_type}`}>
                        {a.body_type === 'urban' ? '🏙️ Urban' : '🌾 Rural'}
                      </span>
                    </td>
                    <td>{a.voter?.district || a.local_body?.ward || '—'}</td>
                    <td>
                      {a.submitted_at
                        ? new Date(a.submitted_at).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-table-action"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/admin/applications/${a.application_id}`)
                        }}
                      >
                        <i className="bi bi-eye-fill" /> View
                      </button>
                    </td>
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
