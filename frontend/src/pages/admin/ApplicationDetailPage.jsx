import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { admin } from '../../api'
import '../../styles/admin.css'

function DetailRow({ icon, label, value }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="detail-row">
      <div className="detail-label-col">
        {icon && <i className={`bi bi-${icon} me-1.5 text-saffron`} />}
        <span>{label}</span>
      </div>
      <div className="detail-value-col">{value}</div>
    </div>
  )
}

function DetailSection({ title, icon, children }) {
  return (
    <div className="admin-card detail-card">
      <div className="admin-card-header">
        <h6 className="admin-card-title">
          <i className={`bi bi-${icon} text-saffron`} /> {title}
        </h6>
      </div>
      <div className="detail-card-body">{children}</div>
    </div>
  )
}

export default function ApplicationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [app, setApp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    admin
      .getApplication(id)
      .then((res) => setApp(res.application))
      .catch((err) => setError(err?.message || 'Failed to load application details.'))
      .finally(() => setLoading(false))
  }, [id])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="spinner-border text-warning" role="status" style={{ width: '3rem', height: '3rem' }} />
      </div>
    )
  }

  if (error || !app) {
    return (
      <div className="admin-detail-view">
        <button
          type="button"
          className="btn-back"
          onClick={() => navigate('/admin/applications')}
        >
          <i className="bi bi-arrow-left" /> Back to Registry
        </button>
        <div className="empty-state">
          <i className="bi bi-exclamation-triangle-fill text-warning" />
          <p>{error || 'Application record not found.'}</p>
        </div>
      </div>
    )
  }

  const v = app.voter || {}
  const lb = app.local_body || {}
  const social = app.social_media || {}
  const prefs = app.position_preferences || []

  return (
    <div className="admin-detail-view">
      {/* Header Bar */}
      <div className="page-header detail-header-bar">
        <div>
          <button
            type="button"
            className="btn-back"
            onClick={() => navigate('/admin/applications')}
          >
            <i className="bi bi-arrow-left" /> Back to Applications Registry
          </button>
          <div className="detail-title-group">
            <h1 className="monospace-title">{app.application_id}</h1>
            <span className="submission-time-badge">
              <i className="bi bi-calendar3 me-1" />
              Submitted on{' '}
              {app.submitted_at
                ? new Date(app.submitted_at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </span>
          </div>
        </div>

        <div className="detail-actions">
          <button type="button" className="btn-print-card" onClick={handlePrint}>
            <i className="bi bi-printer-fill" /> Print Record
          </button>
          <span className="status-verified-pill">
            <i className="bi bi-shield-check" /> Verified Candidate
          </span>
        </div>
      </div>

      {/* Hero Overview Card */}
      <div className="admin-card candidate-hero-card">
        <div className="candidate-hero-body">
          <div className="candidate-avatar-large">
            <img src="/bjp_logo.svg" alt="BJP" onError={(e) => { e.target.src = '/bjp_logo.png' }} />
          </div>
          <div className="candidate-hero-info">
            <h2>{v.name || 'Candidate Application'}</h2>
            <div className="candidate-meta-pills">
              {v.district && <span className="meta-pill"><i className="bi bi-geo-alt-fill" /> {v.district} District</span>}
              {app.membership_id && <span className="meta-pill membership"><i className="bi bi-card-text" /> Membership #{app.membership_id}</span>}
              {app.mobile && <span className="meta-pill mobile"><i className="bi bi-telephone-fill" /> {app.mobile}</span>}
              <span className={`meta-pill body-type ${app.body_type}`}>
                {app.body_type === 'urban' ? '🏙️ Urban Body' : '🌾 Rural Panchayat'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Sections */}
      <div className="detail-cards-grid">
        {/* Personal & Voter Info */}
        <DetailSection title="Personal & Voter Details" icon="person-badge-fill">
          <DetailRow icon="person" label="Candidate Name" value={v.name} />
          <DetailRow icon="people" label="Relation Name" value={v.relation_name} />
          <DetailRow icon="gender-ambiguous" label="Age / Gender" value={[v.age, v.gender].filter(Boolean).join(' / ')} />
          <DetailRow icon="card-text" label="EPIC Number" value={app.epic_no || v.epic_no} />
          <DetailRow icon="building" label="Assembly Constituency" value={[v.assembly_name, v.assembly_no].filter(Boolean).join(' — ') || v.assembly_no} />
          <DetailRow icon="geo-alt" label="District" value={v.district} />
          <DetailRow icon="signpost-2" label="Part / Booth" value={[v.part_no, v.booth_name].filter(Boolean).join(' — ')} />
          <DetailRow icon="phone" label="Mobile Number" value={app.mobile} />
          <DetailRow icon="shield-lock" label="BJP Membership ID" value={app.membership_id} />
        </DetailSection>

        {/* Local Body & Position Preferences */}
        <DetailSection title="Local Body & Position Preferences" icon="building-fill">
          <DetailRow icon="diagram-3" label="Body Type" value={app.body_type === 'urban' ? 'Urban (Corporation / Municipality)' : 'Rural (Panchayat Union / Village)'} />
          {app.body_type === 'urban' && (
            <>
              <DetailRow icon="building" label="Urban Body Type" value={lb.local_body_type} />
              <DetailRow icon="geo" label="Local Body Name" value={lb.local_body} />
              <DetailRow icon="hash" label="Ward / Division" value={lb.ward} />
            </>
          )}
          {app.body_type === 'rural' && (
            <>
              <DetailRow icon="signpost-split" label="Panchayat Union" value={lb.panchayat_union} />
              <DetailRow icon="tree" label="Village Panchayat" value={lb.village_panchayat} />
              <DetailRow icon="hash" label="Ward / Area" value={lb.ward} />
            </>
          )}
          {prefs.map((p, i) => (
            <DetailRow
              key={i}
              icon="trophy"
              label={`${['1st', '2nd', '3rd'][i] || `${i + 1}th`} Preferred Position`}
              value={p}
            />
          ))}
        </DetailSection>

        {/* Social Media Channels */}
        <DetailSection title="Official Social Media Handles" icon="share-fill">
          {['facebook', 'instagram', 'twitter', 'youtube'].map((k) =>
            social[k] ? (
              <div key={k} className="social-detail-item">
                <span className="social-label">
                  <i className={`bi bi-${k === 'twitter' ? 'twitter-x' : k} me-1.5`} />
                  {k.toUpperCase()}
                </span>
                <a
                  href={social[k]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  {social[k]} <i className="bi bi-box-arrow-up-right ms-1" />
                </a>
              </div>
            ) : null
          )}
        </DetailSection>

        {/* Experience & Local Area Understanding */}
        <DetailSection title="Work & Experience" icon="briefcase-fill">
          <div className="text-content-box">{app.work_experience || 'No work experience specified.'}</div>
        </DetailSection>

        <DetailSection title="Local Area Understanding & Vision" icon="chat-left-text-fill">
          <div className="text-content-box">{app.local_area_understanding || 'No local area understanding specified.'}</div>
        </DetailSection>
      </div>
    </div>
  )
}
