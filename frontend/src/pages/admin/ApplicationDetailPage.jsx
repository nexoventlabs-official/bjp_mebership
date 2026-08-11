import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { admin } from '../../api'
import '../../styles/admin.css'

function Row({ label, value }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--border-dim, rgba(0,0,0,0.06))', fontSize: 13.5 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div className="admin-card" style={{ marginBottom: 16 }}>
      <div className="admin-card-header">
        <h6 className="admin-card-title"><i className={`bi bi-${icon} text-coral`} /> {title}</h6>
      </div>
      <div style={{ padding: '4px 20px 12px' }}>{children}</div>
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
    admin.getApplication(id)
      .then((res) => setApp(res.application))
      .catch((err) => setError(err?.message || 'Failed to load application.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner-border text-danger" role="status" /></div>
  }
  if (error || !app) {
    return (
      <div>
        <button onClick={() => navigate('/admin/applications')} style={{ background: 'none', border: 'none', color: 'var(--color-harvest-flame)', cursor: 'pointer', marginBottom: 16 }}>
          <i className="bi bi-arrow-left" /> Back to applications
        </button>
        <div className="empty-state" style={{ padding: 40, textAlign: 'center', color: 'var(--admin-ink-dim)' }}>
          <i className="bi bi-exclamation-triangle" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
          {error || 'Application not found.'}
        </div>
      </div>
    )
  }

  const v = app.voter || {}
  const lb = app.local_body || {}
  const social = app.social_media || {}
  const prefs = app.position_preferences || []

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button onClick={() => navigate('/admin/applications')} style={{ background: 'none', border: 'none', color: 'var(--color-harvest-flame)', cursor: 'pointer', marginBottom: 8, padding: 0 }}>
            <i className="bi bi-arrow-left" /> Back to applications
          </button>
          <h1 style={{ fontFamily: 'monospace' }}>{app.application_id}</h1>
          <p>Submitted {app.submitted_at ? new Date(app.submitted_at).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</p>
        </div>
        <span style={{ background: 'rgba(46,125,50,0.12)', color: '#2e7d32', border: '1px solid rgba(46,125,50,0.3)', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>
          {app.status || 'submitted'}
        </span>
      </div>

      <Section title="Personal & Voter Details" icon="person-fill">
        <Row label="Name" value={v.name} />
        <Row label="Relation Name" value={v.relation_name} />
        <Row label="Age / Gender" value={[v.age, v.gender].filter(Boolean).join(' / ')} />
        <Row label="EPIC No" value={app.epic_no || v.epic_no} />
        <Row label="Assembly" value={[v.assembly_name, v.assembly_no].filter(Boolean).join(' — ') || v.assembly_no} />
        <Row label="District" value={v.district} />
        <Row label="Part / Booth" value={[v.part_no, v.booth_name].filter(Boolean).join(' — ')} />
        <Row label="Mobile Number" value={app.mobile} />
        <Row label="BJP Membership ID" value={app.membership_id} />
      </Section>

      <Section title="Local Body & Position" icon="building-fill">
        <Row label="Local Body Type" value={app.body_type} />
        {app.body_type === 'urban' && (
          <>
            <Row label="Urban Body Type" value={lb.local_body_type} />
            <Row label="Local Body" value={lb.local_body} />
            <Row label="Ward / Area" value={lb.ward} />
          </>
        )}
        {app.body_type === 'rural' && (
          <>
            <Row label="Panchayat Union" value={lb.panchayat_union} />
            <Row label="Village Panchayat" value={lb.village_panchayat} />
            <Row label="Ward / Area" value={lb.ward} />
          </>
        )}
        {prefs.map((p, i) => (
          <Row key={i} label={`${['1st', '2nd', '3rd'][i] || `${i + 1}th`} Preference`} value={p} />
        ))}
      </Section>

      <Section title="Social Media" icon="share-fill">
        {['facebook', 'instagram', 'twitter', 'youtube'].map((k) =>
          social[k] ? (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--border-dim, rgba(0,0,0,0.06))', fontSize: 13.5 }}>
              <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{k}</span>
              <a href={social[k]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-harvest-flame)', fontWeight: 600, wordBreak: 'break-all', textAlign: 'right' }}>{social[k]}</a>
            </div>
          ) : null
        )}
      </Section>

      <Section title="Work & Experience" icon="briefcase-fill">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{app.work_experience || '—'}</div>
      </Section>

      <Section title="Local Area Understanding" icon="chat-left-text-fill">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{app.local_area_understanding || '—'}</div>
      </Section>
    </div>
  )
}
