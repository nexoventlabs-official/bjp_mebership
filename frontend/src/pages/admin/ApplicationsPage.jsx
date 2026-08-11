import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { admin } from '../../api'
import '../../styles/admin.css'

const PER_PAGE = 20

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
      <span className="pagination-info" style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-secondary)' }}>{total} total</span>
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
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await admin.getApplications({ page, page_size: PER_PAGE, search: query })
      setRows(res.applications || [])
      setTotal(res.total || 0)
    } catch {
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => { load() }, [load])

  const submitSearch = (e) => {
    e?.preventDefault()
    setPage(1)
    setQuery(search.trim())
  }

  const positionText = (a) => (a.position_preferences || []).join(', ')

  return (
    <div>
      <div className="page-header">
        <h1><i className="bi bi-card-checklist me-2 text-coral" />Applications</h1>
        <p>All Local Body candidate applications</p>
      </div>

      <div className="admin-card">
        <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h6 className="admin-card-title"><i className="bi bi-list-ul text-coral" /> All Applications</h6>
          <form className="admin-card-tools" onSubmit={submitSearch} style={{ display: 'flex', gap: 8 }}>
            <input
              className="admin-search-input"
              placeholder="Search ID, name, mobile, EPIC, membership…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 240 }}
            />
            <button className="page-btn" type="submit" title="Search"><i className="bi bi-search" /></button>
            {query && (
              <button className="page-btn" type="button" title="Clear"
                onClick={() => { setSearch(''); setQuery(''); setPage(1) }}>
                <i className="bi bi-x-lg" />
              </button>
            )}
          </form>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner-border text-danger" role="status" />
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state" style={{ padding: 40, textAlign: 'center', color: 'var(--admin-ink-dim)' }}>
            <i className="bi bi-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
            No applications found.
          </div>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Application ID</th>
                    <th>Name</th>
                    <th>Mobile</th>
                    <th>Membership</th>
                    <th>Type</th>
                    <th>Position</th>
                    <th>Submitted</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.application_id} style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/admin/applications/${a.application_id}`)}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.application_id}</td>
                      <td>{a.voter?.name || '—'}</td>
                      <td>{a.mobile}</td>
                      <td>{a.membership_id}</td>
                      <td style={{ textTransform: 'capitalize' }}>{a.body_type}</td>
                      <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={positionText(a)}>{positionText(a) || '—'}</td>
                      <td>{a.submitted_at ? new Date(a.submitted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td><i className="bi bi-chevron-right" style={{ color: 'var(--admin-ink-dim)' }} /></td>
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
