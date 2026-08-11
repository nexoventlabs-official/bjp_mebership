import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { admin } from '../../api'
import { RURAL_POSITIONS, URBAN_POSITIONS } from '../../data/localBodies.js'
import '../../styles/admin.css'

const PER_PAGE = 15

function Pagination({ page, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / PER_PAGE))
  if (pages <= 1) return null
  const nums = []
  const from = Math.max(1, page - 2)
  const to = Math.min(pages, from + 4)
  for (let i = from; i <= to; i += 1) nums.push(i)
  return (
    <div className="admin-pagination">
      <button className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}><i className="bi bi-chevron-left" /></button>
      {nums.map((n) => (
        <button key={n} className={`page-btn${n === page ? ' active' : ''}`} onClick={() => onChange(n)}>{n}</button>
      ))}
      <button className="page-btn" disabled={page >= pages} onClick={() => onChange(page + 1)}><i className="bi bi-chevron-right" /></button>
      <span className="pagination-info">{total} records</span>
    </div>
  )
}

// Escape a value for CSV (wrap in quotes, double internal quotes).
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`

function localBodyText(a) {
  const lb = a.local_body || {}
  if (a.body_type === 'urban') return [lb.local_body_type, lb.local_body, lb.ward && `Ward ${lb.ward}`].filter(Boolean).join(' / ')
  if (a.body_type === 'rural') return [lb.panchayat_union, lb.village_panchayat, lb.ward && `Ward ${lb.ward}`].filter(Boolean).join(' / ')
  return ''
}

function socialText(a) {
  const s = a.social_media || {}
  return ['facebook', 'instagram', 'twitter', 'youtube'].map((k) => (s[k] ? `${k}: ${s[k]}` : '')).filter(Boolean).join(' | ')
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Filters (applied on submit)
  const [bodyType, setBodyType] = useState('all')
  const [position, setPosition] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState({ bodyType: 'all', position: '', from: '', to: '', search: '' })

  const positionOptions = bodyType === 'rural' ? RURAL_POSITIONS
    : bodyType === 'urban' ? URBAN_POSITIONS
    : [...RURAL_POSITIONS, ...URBAN_POSITIONS]

  const buildParams = (extra = {}) => ({
    ...(applied.bodyType !== 'all' ? { body_type: applied.bodyType } : {}),
    ...(applied.position ? { position: applied.position } : {}),
    ...(applied.from ? { from: applied.from } : {}),
    ...(applied.to ? { to: applied.to } : {}),
    ...(applied.search ? { search: applied.search } : {}),
    ...extra,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await admin.getReports(buildParams({ page, page_size: PER_PAGE }))
      setRows(res.applications || [])
      setTotal(res.total || 0)
    } catch {
      setRows([]); setTotal(0)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, applied])

  useEffect(() => { load() }, [load])

  const applyFilters = (e) => {
    e?.preventDefault()
    setPage(1)
    setApplied({ bodyType, position, from, to, search: search.trim() })
  }

  const resetFilters = () => {
    setBodyType('all'); setPosition(''); setFrom(''); setTo(''); setSearch('')
    setPage(1)
    setApplied({ bodyType: 'all', position: '', from: '', to: '', search: '' })
  }

  const handleDownloadCSV = async () => {
    setExporting(true)
    try {
      // Fetch the full filtered set (not just the current page).
      const res = await admin.getReports(buildParams({ page: 1, page_size: 5000 }))
      const data = res.applications || []
      const headers = [
        'Application ID', 'Submitted At', 'Candidate Name', 'Relation Name', 'Age', 'Gender',
        'Mobile', 'Membership ID', 'EPIC No', 'Assembly No', 'Assembly Name', 'District',
        'Part No', 'Booth', 'Body Type', 'Local Body Details',
        '1st Preference', '2nd Preference', '3rd Preference',
        'Social Media', 'Work & Experience', 'Local Area Understanding',
      ]
      const lines = [headers.map(csvCell).join(',')]
      data.forEach((a) => {
        const v = a.voter || {}
        const prefs = a.position_preferences || []
        lines.push([
          a.application_id,
          a.submitted_at ? new Date(a.submitted_at).toLocaleString('en-IN') : '',
          v.name, v.relation_name, v.age, v.gender,
          a.mobile, a.membership_id, a.epic_no || v.epic_no,
          v.assembly_no, v.assembly_name, v.district,
          v.part_no, v.booth_name,
          a.body_type, localBodyText(a),
          prefs[0] || '', prefs[1] || '', prefs[2] || '',
          socialText(a), a.work_experience, a.local_area_understanding,
        ].map(csvCell).join(','))
      })
      // Prepend UTF-8 BOM so Excel renders Tamil/Unicode correctly.
      const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      link.href = url
      link.setAttribute('download', `BJP_LocalBody_Report_${stamp}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      alert('Could not generate the report. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const positionText = (a) => (a.position_preferences || []).join(', ')

  return (
    <div className="admin-applications-view">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1><i className="bi bi-file-earmark-bar-graph-fill me-2 text-saffron" /> Reports</h1>
          <p>Filter candidate applications and export as CSV / Excel</p>
        </div>
        <button type="button" className="btn-export-csv" onClick={handleDownloadCSV} disabled={exporting || total === 0}>
          {exporting
            ? <><span className="spinner-border spinner-border-sm me-2" /> Preparing…</>
            : <><i className="bi bi-download" /> Download CSV ({total})</>}
        </button>
      </div>

      {/* Filters */}
      <div className="admin-card" style={{ marginBottom: 20 }}>
        <div className="admin-card-header">
          <h6 className="admin-card-title"><i className="bi bi-funnel-fill text-saffron" /> Filters</h6>
        </div>
        <form onSubmit={applyFilters} style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, alignItems: 'end' }}>
          <div>
            <label className="report-filter-label">Local Body Type</label>
            <select className="admin-select" style={{ width: '100%' }} value={bodyType}
              onChange={(e) => { setBodyType(e.target.value); setPosition('') }}>
              <option value="all">All Types</option>
              <option value="rural">Rural</option>
              <option value="urban">Urban</option>
            </select>
          </div>
          <div>
            <label className="report-filter-label">Position</label>
            <select className="admin-select" style={{ width: '100%' }} value={position}
              onChange={(e) => setPosition(e.target.value)}>
              <option value="">All Positions</option>
              {positionOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="report-filter-label">From Date</label>
            <input type="date" className="admin-select" style={{ width: '100%' }} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="report-filter-label">To Date</label>
            <input type="date" className="admin-select" style={{ width: '100%' }} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="report-filter-label">Search</label>
            <input type="text" className="admin-search-input" style={{ width: '100%' }} placeholder="Name, ID, mobile, EPIC…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn-search-submit" style={{ flex: 1 }}><i className="bi bi-funnel" /> Apply</button>
            <button type="button" className="btn-search-clear" onClick={resetFilters} title="Reset filters"><i className="bi bi-arrow-counterclockwise" /></button>
          </div>
        </form>
      </div>

      {/* Results */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h6 className="admin-card-title"><i className="bi bi-table text-saffron" /> Report Results</h6>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <div className="spinner-border text-warning" role="status" style={{ width: '2.5rem', height: '2.5rem' }} />
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-clipboard-x" />
            <p>No records match the selected filters.</p>
          </div>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Application ID</th>
                    <th>Candidate Name</th>
                    <th>Mobile</th>
                    <th>District</th>
                    <th>Body Type</th>
                    <th>Positions</th>
                    <th>Submitted</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.application_id} className="table-row-hover" onClick={() => navigate(`/admin/applications/${a.application_id}`)}>
                      <td><span className="app-id-pill">{a.application_id}</span></td>
                      <td className="fw-bold">{a.voter?.name || '—'}</td>
                      <td>{a.mobile}</td>
                      <td>{a.voter?.district || '—'}</td>
                      <td><span className={`body-type-badge ${a.body_type}`}>{a.body_type === 'urban' ? '🏙️ Urban' : '🌾 Rural'}</span></td>
                      <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={positionText(a)}>{positionText(a) || '—'}</td>
                      <td>{a.submitted_at ? new Date(a.submitted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td>
                        <button type="button" className="btn-table-action" onClick={(e) => { e.stopPropagation(); navigate(`/admin/applications/${a.application_id}`) }}>
                          <i className="bi bi-eye-fill" /> Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={total} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
