import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { admin } from '../../api'
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
      <button className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <i className="bi bi-chevron-left" />
      </button>
      {nums.map((n) => (
        <button key={n} className={`page-btn${n === page ? ' active' : ''}`} onClick={() => onChange(n)}>
          {n}
        </button>
      ))}
      <button className="page-btn" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        <i className="bi bi-chevron-right" />
      </button>
      <span className="pagination-info">{total} Candidates Registered</span>
    </div>
  )
}

export default function ApplicationsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [bodyTypeFilter, setBodyTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await admin.getApplications({ page, page_size: PER_PAGE, search: query })
      let filtered = res.applications || []
      if (bodyTypeFilter !== 'all') {
        filtered = filtered.filter((a) => a.body_type === bodyTypeFilter)
      }
      setRows(filtered)
      setTotal(res.total || 0)
    } catch {
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, query, bodyTypeFilter])

  useEffect(() => {
    load()
  }, [load])

  const submitSearch = (e) => {
    e?.preventDefault()
    setPage(1)
    setQuery(search.trim())
  }

  // Export CSV
  const handleExportCSV = () => {
    if (!rows.length) return
    const headers = ['Application ID', 'Candidate Name', 'Mobile', 'Membership ID', 'EPIC No', 'District', 'Body Type', 'Preferences', 'Submitted At']
    const csvRows = [headers.join(',')]

    rows.forEach((a) => {
      const prefs = (a.position_preferences || []).join(' | ')
      const row = [
        `"${a.application_id || ''}"`,
        `"${a.voter?.name || ''}"`,
        `"${a.mobile || ''}"`,
        `"${a.membership_id || ''}"`,
        `"${a.epic_no || a.voter?.epic_no || ''}"`,
        `"${a.voter?.district || ''}"`,
        `"${a.body_type || ''}"`,
        `"${prefs}"`,
        `"${a.submitted_at ? new Date(a.submitted_at).toLocaleString('en-IN') : ''}"`,
      ]
      csvRows.push(row.join(','))
    })

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `BJP_LocalBody_Candidates_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const positionText = (a) => (a.position_preferences || []).join(', ')

  return (
    <div className="admin-applications-view">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>
            <i className="bi bi-card-checklist me-2 text-saffron" />
            Candidate Applications Registry
          </h1>
          <p>Search, filter, and manage all BJP Local Body Candidate submissions</p>
        </div>
        <button
          type="button"
          className="btn-export-csv"
          onClick={handleExportCSV}
          disabled={!rows.length}
        >
          <i className="bi bi-file-earmark-spreadsheet-fill" /> Export CSV / Excel
        </button>
      </div>

      <div className="admin-card">
        <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="admin-filter-group" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <h6 className="admin-card-title me-2">
              <i className="bi bi-filter-circle-fill text-saffron" /> Filters
            </h6>
            <select
              className="admin-select"
              value={bodyTypeFilter}
              onChange={(e) => {
                setBodyTypeFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="all">All Local Body Types</option>
              <option value="urban">Urban (Corporation / Municipality)</option>
              <option value="rural">Rural (Panchayat Union / Village)</option>
            </select>
          </div>

          <form className="admin-card-tools" onSubmit={submitSearch} style={{ display: 'flex', gap: 8 }}>
            <div className="admin-search-wrapper">
              <i className="bi bi-search search-icon" />
              <input
                className="admin-search-input"
                placeholder="Search Candidate Name, ID, Mobile, EPIC, Membership..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="btn-search-submit" type="submit" title="Search">
              Search
            </button>
            {query && (
              <button
                className="btn-search-clear"
                type="button"
                title="Clear Search"
                onClick={() => {
                  setSearch('')
                  setQuery('')
                  setPage(1)
                }}
              >
                <i className="bi bi-x-lg" />
              </button>
            )}
          </form>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <div className="spinner-border text-warning" role="status" style={{ width: '2.5rem', height: '2.5rem' }} />
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-inbox" />
            <p>No candidate records found matching your search query.</p>
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
                    <th>Membership ID</th>
                    <th>District</th>
                    <th>Body Type</th>
                    <th>Position Preferences</th>
                    <th>Submitted Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
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
                        <span className="membership-tag">{a.membership_id}</span>
                      </td>
                      <td>{a.voter?.district || '—'}</td>
                      <td>
                        <span className={`body-type-badge ${a.body_type}`}>
                          {a.body_type === 'urban' ? '🏙️ Urban' : '🌾 Rural'}
                        </span>
                      </td>
                      <td
                        style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        title={positionText(a)}
                      >
                        {positionText(a) || '—'}
                      </td>
                      <td>
                        {a.submitted_at
                          ? new Date(a.submitted_at).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
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
