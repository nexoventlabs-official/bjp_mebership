import React, { useState, useEffect, useRef, useCallback } from 'react'
import { chat } from '../api'
import '../styles/chatbot.css'
import { useLang } from '../i18n/LanguageContext'
import { positionsFor, URBAN_BODY_TYPES, bodiesForType } from '../data/localBodies.js'

// ── Flow states ────────────────────────────────────────────
const S = {
  WELCOME:          'WELCOME',
  AWAIT_MOBILE:     'AWAIT_MOBILE',
  AWAIT_OTP:        'AWAIT_OTP',
  AWAIT_MEMBERSHIP: 'AWAIT_MEMBERSHIP',
  AWAIT_EPIC:       'AWAIT_EPIC',
  CONFIRM_VOTER:    'CONFIRM_VOTER',
  LOCAL_BODY:       'LOCAL_BODY',
  POSITION:         'POSITION',
  SOCIAL:           'SOCIAL',
  WORK:             'WORK',
  LOCAL_AREA:       'LOCAL_AREA',
  REVIEW:           'REVIEW',
  SUBMITTING:       'SUBMITTING',
  SUBMITTED:        'SUBMITTED',
}

const MAX_WORDS = 500
const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const maskMobile = (m) => (m ? m.slice(0, 2) + 'XXXXXX' + m.slice(-2) : '')
const countWords = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

const emptyLocalBody = () => ({
  urbanType: '', urbanBody: '', urbanWard: '',
  ruralUnion: '', ruralPanchayat: '', ruralWard: '',
})

const emptyAppData = () => ({
  membershipId: '',
  epic: '',
  voter: null,
  bodyType: '',
  localBody: emptyLocalBody(),
  positionPrefs: ['', '', ''],
  social: { facebook: '', instagram: '', twitter: '', youtube: '' },
  workExperience: '',
  localArea: '',
})

// Human-readable one-liner for a chosen local body.
function localBodySummary(bodyType, lb) {
  if (!lb) return ''
  if (bodyType === 'urban') {
    return [lb.urbanType, lb.urbanBody, lb.urbanWard && `${lb.urbanWard}`].filter(Boolean).join(' · ')
  }
  if (bodyType === 'rural') {
    return [lb.ruralUnion, lb.ruralPanchayat, lb.ruralWard].filter(Boolean).join(' · ')
  }
  return ''
}

// Build the API payload sub-object for local body.
function localBodyPayload(bodyType, lb) {
  if (bodyType === 'urban') {
    return { type: 'urban', local_body_type: lb.urbanType, local_body: lb.urbanBody, ward: lb.urbanWard }
  }
  return { type: 'rural', panchayat_union: lb.ruralUnion, village_panchayat: lb.ruralPanchayat, ward: lb.ruralWard }
}

function localBodyComplete(bodyType, lb) {
  if (bodyType === 'urban') return !!(lb.urbanType && lb.urbanBody && lb.urbanWard.trim())
  if (bodyType === 'rural') return !!(lb.ruralUnion.trim() && lb.ruralPanchayat.trim() && lb.ruralWard.trim())
  return false
}

// ── Welcome banner ─────────────────────────────────────────
function WelcomeBannerMsg({ onStart }) {
  const { t } = useLang()
  return (
    <div className="welcome-banner">
      <img src="/banner.png" alt="BJP Tamil Nadu" className="banner-img" loading="lazy"
        onError={(e) => { e.target.style.display = 'none' }} />
      <div className="banner-content">
        <h2>{t('BJP Tamil Nadu — Local Body Candidate Application 2026')}</h2>
        <p>{t('Apply to contest the upcoming Local Body Elections. Verify your mobile and voter details, then tell us where you want to serve.')}</p>
        <button className="btn-start" onClick={onStart}>
          <i className="bi bi-play-circle-fill" /> {t('Start Application')}
        </button>
      </div>
    </div>
  )
}

// ── Voter confirmation card ────────────────────────────────
function VoterCardMsg({ voter, active, onConfirm, onRetry, disabled }) {
  const { t } = useLang()
  const v = voter || {}
  const rows = [
    { label: 'Name', value: v.name },
    { label: "Relation Name", value: v.relation_name },
    { label: 'EPIC No', value: v.epic_no },
    { label: 'Age / Gender', value: [v.age, v.gender].filter(Boolean).join(' / ') || undefined },
    { label: 'Assembly', value: [v.assembly_name, v.assembly_no].filter(Boolean).join(' — ') || v.assembly_no || undefined },
    { label: 'District', value: v.district },
    { label: 'Part / Booth', value: [v.part_no, v.booth_name].filter(Boolean).join(' — ') || undefined },
    { label: 'Serial No', value: v.serial_no },
  ].filter((r) => r.value !== undefined && r.value !== '')

  return (
    <div className="voter-details-card">
      <div className="vdc-header"><i className="bi bi-person-badge" /> {t('Voter Details')}</div>
      <div className="vdc-body">
        {rows.map((r) => (
          <div className="vdc-row" key={r.label}>
            <span className="vdc-label">{t(r.label)}</span>
            <span className="vdc-value">{r.value}</span>
          </div>
        ))}
      </div>
      {active && (
        <div className="interactive-buttons">
          <button className="interactive-btn" onClick={onConfirm} disabled={disabled}>
            <i className="bi bi-check-circle-fill" /> {t('Confirm Details')}
          </button>
          <button className="interactive-btn" onClick={onRetry} disabled={disabled} style={{ color: '#d32f2f' }}>
            <i className="bi bi-arrow-counterclockwise" /> {t('Re-enter ID')}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Shared small styles ────────────────────────────────────
const fieldLabel = { fontSize: 12, fontWeight: 600, color: 'var(--color-chalk)', display: 'block', marginBottom: 6 }
const controlStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  background: 'var(--color-carbon)', color: 'var(--color-chalk)',
  border: '1px solid var(--color-graphite)', fontSize: 14, boxSizing: 'border-box',
}
const primaryBtn = (enabled) => ({
  width: '100%', padding: '12px 16px', marginTop: 4,
  background: enabled ? 'var(--color-signal-mint)' : 'rgba(46,204,113,0.25)',
  color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
  cursor: enabled ? 'pointer' : 'not-allowed',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
})
const cardBox = {
  width: '100%', background: 'var(--color-carbon)', border: '1px solid var(--color-graphite)',
  borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 14,
}
const cardTitle = { fontSize: 13, fontWeight: 700, color: 'var(--color-chalk)', display: 'flex', alignItems: 'center', gap: 8 }

// ── Local Body step (rural/urban + dynamic fields) ─────────
function LocalBodyMsg({ active, initial, onSubmit, disabled }) {
  const { t } = useLang()
  const [bodyType, setBodyType] = useState(initial?.bodyType || '')
  const [lb, setLb] = useState(initial?.localBody || emptyLocalBody())

  const set = (patch) => setLb((prev) => ({ ...prev, ...patch }))
  const ready = bodyType && localBodyComplete(bodyType, lb)

  const urbanBodies = bodyType === 'urban' && lb.urbanType ? bodiesForType(lb.urbanType) : []

  const typeBtn = (val, title, sub) => (
    <button
      type="button"
      onClick={() => active && setBodyType(val)}
      disabled={!active}
      style={{
        flex: 1, textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: active ? 'pointer' : 'default',
        background: bodyType === val ? 'rgba(46,204,113,0.10)' : 'var(--color-abyss)',
        border: `1.5px solid ${bodyType === val ? 'var(--color-signal-mint)' : 'var(--color-graphite)'}`,
        color: 'var(--color-chalk)',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13 }}>
        {bodyType === val && <i className="bi bi-check-circle-fill" style={{ color: 'var(--color-signal-mint)', marginRight: 6 }} />}
        {title}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-ash)', marginTop: 3 }}>{sub}</div>
    </button>
  )

  return (
    <div style={cardBox}>
      <div style={cardTitle}><i className="bi bi-geo-alt-fill" /> {t('Local Body Details')}</div>

      <div>
        <span style={fieldLabel}>{t('Local body type')}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          {typeBtn('rural', t('Rural Local Body'), t('Panchayats, Unions, District Panchayat'))}
          {typeBtn('urban', t('Urban Local Body'), t('Town Panchayats, Municipalities, Corporations'))}
        </div>
      </div>

      {/* URBAN: local body type -> local body -> ward */}
      {bodyType === 'urban' && (
        <>
          <div>
            <span style={fieldLabel}>{t('Select Local Body Type')}</span>
            <select style={controlStyle} value={lb.urbanType} disabled={!active}
              onChange={(e) => set({ urbanType: e.target.value, urbanBody: '' })}>
              <option value="">{t('Select local body type')}</option>
              {URBAN_BODY_TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
            </select>
          </div>
          <div>
            <span style={fieldLabel}>{t('Select Local Body')}</span>
            <select style={controlStyle} value={lb.urbanBody} disabled={!active || !lb.urbanType}
              onChange={(e) => set({ urbanBody: e.target.value })}>
              <option value="">{lb.urbanType ? t('Select local body') : t('Select local body type first')}</option>
              {urbanBodies.map((b) => <option key={b.label} value={b.name}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <span style={fieldLabel}>{t('Enter Ward / Area')}</span>
            <input style={controlStyle} type="text" value={lb.urbanWard} disabled={!active}
              placeholder={t('e.g. Ward 12 / area name')}
              onChange={(e) => set({ urbanWard: e.target.value })} />
          </div>
        </>
      )}

      {/* RURAL: three manual fields */}
      {bodyType === 'rural' && (
        <>
          <div>
            <span style={fieldLabel}>{t('Panchayat Union (Block)')}</span>
            <input style={controlStyle} type="text" value={lb.ruralUnion} disabled={!active}
              placeholder={t('Enter Panchayat Union / Block')}
              onChange={(e) => set({ ruralUnion: e.target.value })} />
          </div>
          <div>
            <span style={fieldLabel}>{t('Village Panchayat')}</span>
            <input style={controlStyle} type="text" value={lb.ruralPanchayat} disabled={!active}
              placeholder={t('Enter Village Panchayat')}
              onChange={(e) => set({ ruralPanchayat: e.target.value })} />
          </div>
          <div>
            <span style={fieldLabel}>{t('Enter Ward / Area')}</span>
            <input style={controlStyle} type="text" value={lb.ruralWard} disabled={!active}
              placeholder={t('e.g. Ward 3 / area name')}
              onChange={(e) => set({ ruralWard: e.target.value })} />
          </div>
        </>
      )}

      {active && (
        <button style={primaryBtn(ready && !disabled)} disabled={!ready || disabled}
          onClick={() => ready && onSubmit({ bodyType, localBody: lb })}>
          {t('Continue')} <i className="bi bi-arrow-right" />
        </button>
      )}
    </div>
  )
}

// ── Position to Contest (checkbox preferences + position dropdown) ──
const PREF_LABELS = ['1st Preference', '2nd Preference', '3rd Preference']

function PositionMsg({ active, bodyType, initial, onSubmit, disabled }) {
  const { t } = useLang()
  const options = positionsFor(bodyType)
  // Each preference: { enabled, value }. 1st is always enabled/required.
  const [prefs, setPrefs] = useState(() => [0, 1, 2].map((i) => ({
    enabled: i === 0 ? true : !!(initial && initial[i]),
    value: (initial && initial[i]) || '',
  })))

  const setValue = (idx, value) => setPrefs((prev) => {
    const next = prev.map((p) => ({ ...p })); next[idx].value = value; return next
  })
  const toggle = (idx) => {
    if (idx === 0) return // 1st always required
    setPrefs((prev) => {
      const next = prev.map((p) => ({ ...p }))
      next[idx].enabled = !next[idx].enabled
      if (!next[idx].enabled) next[idx].value = ''
      return next
    })
  }

  // Options available for a row = not already chosen by another enabled row.
  const availableFor = (idx) => options.filter((o) => !prefs.some((p, i) => i !== idx && p.enabled && p.value === o))

  // Ready when every enabled preference has a position chosen (1st mandatory).
  const ready = prefs[0].value && prefs.every((p) => !p.enabled || p.value)

  const handleContinue = () => {
    if (!ready) return
    const chosen = prefs.filter((p) => p.enabled && p.value).map((p) => p.value)
    onSubmit(chosen)
  }

  return (
    <div style={cardBox}>
      <div style={cardTitle}><i className="bi bi-trophy-fill" /> {t('Position to Contest')}</div>
      <div style={{ fontSize: 12, color: 'var(--color-ash)' }}>
        {t('Tick the preferences you want and choose a position for each. 1st preference is required.')}
      </div>

      {prefs.map((p, idx) => {
        const required = idx === 0
        return (
          <div key={idx} style={{
            border: `1px solid ${p.enabled ? 'var(--color-signal-mint)' : 'var(--color-graphite)'}`,
            borderRadius: 10, padding: '10px 12px',
            background: p.enabled ? 'rgba(46,204,113,0.06)' : 'var(--color-abyss)',
            opacity: p.enabled ? 1 : 0.85,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: required || !active ? 'default' : 'pointer', marginBottom: p.enabled ? 8 : 0 }}>
              <input
                type="checkbox"
                checked={p.enabled}
                disabled={required || !active}
                onChange={() => toggle(idx)}
                style={{ width: 16, height: 16, accentColor: 'var(--color-signal-mint)', cursor: required || !active ? 'default' : 'pointer' }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-chalk)' }}>
                {t(PREF_LABELS[idx])}{required && <span style={{ color: '#e74c3c' }}> *</span>}
                {!required && <span style={{ color: 'var(--color-ash)', fontWeight: 400 }}> ({t('optional')})</span>}
              </span>
            </label>
            {p.enabled && (
              <select style={controlStyle} value={p.value} disabled={!active}
                onChange={(e) => setValue(idx, e.target.value)}>
                <option value="">{t('Select a position')}</option>
                {availableFor(idx).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
          </div>
        )
      })}

      {active && (
        <button style={primaryBtn(ready && !disabled)} disabled={!ready || disabled} onClick={handleContinue}>
          {t('Continue')} <i className="bi bi-arrow-right" />
        </button>
      )}
    </div>
  )
}

// ── Social media (at least 1 valid URL) ────────────────────
const SOCIALS = [
  { key: 'facebook', label: 'Facebook URL', icon: 'facebook', placeholder: 'https://facebook.com/yourpage' },
  { key: 'instagram', label: 'Instagram URL', icon: 'instagram', placeholder: 'https://instagram.com/yourhandle' },
  { key: 'twitter', label: 'Twitter / X URL', icon: 'twitter-x', placeholder: 'https://x.com/yourhandle' },
  { key: 'youtube', label: 'YouTube URL', icon: 'youtube', placeholder: 'https://youtube.com/@yourchannel' },
]

function SocialMediaMsg({ active, initial, onSubmit, disabled }) {
  const { t } = useLang()
  const [vals, setVals] = useState(initial || { facebook: '', instagram: '', twitter: '', youtube: '' })
  const [error, setError] = useState('')
  const set = (k, v) => setVals((prev) => ({ ...prev, [k]: v }))

  const handleContinue = () => {
    const filled = SOCIALS.map((s) => [s.key, (vals[s.key] || '').trim()]).filter(([, v]) => v)
    if (!filled.length) { setError(t('Please add at least one social media URL.')); return }
    for (const [k, v] of filled) {
      if (!URL_RE.test(v)) { setError(t('Please enter a valid URL for {field}.', { field: k })); return }
    }
    setError('')
    onSubmit(Object.fromEntries(filled))
  }

  return (
    <div style={cardBox}>
      <div style={cardTitle}><i className="bi bi-share-fill" /> {t('Add Your Social Media')}</div>
      <div style={{ fontSize: 12, color: 'var(--color-ash)' }}>
        {t('Add at least one valid social media profile URL.')}
      </div>
      {SOCIALS.map((s) => (
        <div key={s.key}>
          <span style={fieldLabel}><i className={`bi bi-${s.icon}`} style={{ marginRight: 6 }} />{t(s.label)}</span>
          <input style={controlStyle} type="url" value={vals[s.key]} disabled={!active} placeholder={s.placeholder}
            onChange={(e) => { set(s.key, e.target.value); if (error) setError('') }} />
        </div>
      ))}
      {error && <div style={{ fontSize: 12, color: '#e74c3c' }}><i className="bi bi-exclamation-circle" /> {error}</div>}
      {active && (
        <button style={primaryBtn(!disabled)} disabled={disabled} onClick={handleContinue}>
          {t('Continue')} <i className="bi bi-arrow-right" />
        </button>
      )}
    </div>
  )
}

// ── Long text step (work / experience, local area) ─────────
function LongTextMsg({ active, title, icon, prompt, initial, onSubmit, disabled }) {
  const { t } = useLang()
  const [text, setText] = useState(initial || '')
  const words = countWords(text)
  const over = words > MAX_WORDS
  const ready = words > 0 && !over

  return (
    <div style={cardBox}>
      <div style={cardTitle}><i className={`bi bi-${icon}`} /> {t(title)}</div>
      <div style={{ fontSize: 12, color: 'var(--color-ash)' }}>{t(prompt)}</div>
      <textarea value={text} disabled={!active} onChange={(e) => setText(e.target.value)} rows={6}
        placeholder={t('Type here…')}
        style={{ ...controlStyle, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }} />
      <div style={{ fontSize: 11, color: over ? '#e74c3c' : 'var(--color-ash)', textAlign: 'right' }}>
        {words} / {MAX_WORDS} {t('words')}
      </div>
      {active && (
        <button style={primaryBtn(ready && !disabled)} disabled={!ready || disabled}
          onClick={() => ready && onSubmit(text.trim())}>
          {t('Continue')} <i className="bi bi-arrow-right" />
        </button>
      )}
    </div>
  )
}

// ── Review + edit ──────────────────────────────────────────
function ReviewSection({ title, icon, children }) {
  return (
    <div style={{ borderTop: '1px solid var(--color-graphite)', paddingTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-signal-mint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className={`bi bi-${icon}`} /> {title}
      </div>
      {children}
    </div>
  )
}
function KV({ k, v }) {
  if (v === undefined || v === null || v === '') return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '3px 0' }}>
      <span style={{ color: 'var(--color-ash)' }}>{k}</span>
      <span style={{ color: 'var(--color-chalk)', fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
    </div>
  )
}

function ReviewMsg({ active, data, mobile, onConfirm, onEdit, disabled }) {
  const { t } = useLang()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data)
  const [error, setError] = useState('')
  const cur = editing ? draft : data
  const v = cur.voter || {}
  const lb = cur.localBody || emptyLocalBody()
  const options = positionsFor(cur.bodyType)

  const setDraftField = (patch) => setDraft((prev) => ({ ...prev, ...patch }))
  const setLb = (patch) => setDraft((prev) => ({ ...prev, localBody: { ...prev.localBody, ...patch } }))
  const setPref = (idx, val) => setDraft((prev) => {
    const next = [...prev.positionPrefs]; next[idx] = val; return { ...prev, positionPrefs: next }
  })
  const setSocial = (k, val) => setDraft((prev) => ({ ...prev, social: { ...prev.social, [k]: val } }))
  const availableFor = (idx) => options.filter((o) => !draft.positionPrefs.some((p, i) => i !== idx && p === o))
  const draftUrbanBodies = draft.bodyType === 'urban' && draft.localBody.urbanType ? bodiesForType(draft.localBody.urbanType) : []

  const saveEdits = () => {
    if (!draft.bodyType || !localBodyComplete(draft.bodyType, draft.localBody)) { setError(t('Please complete all local body fields.')); return }
    if (!draft.positionPrefs[0]) { setError(t('1st preference position is required.')); return }
    const filledSocial = Object.entries(draft.social).map(([k, val]) => [k, (val || '').trim()]).filter(([, val]) => val)
    if (!filledSocial.length) { setError(t('Add at least one social media URL.')); return }
    for (const [k, val] of filledSocial) {
      if (!URL_RE.test(val)) { setError(t('Invalid URL for {field}.', { field: k })); return }
    }
    if (!draft.workExperience.trim() || countWords(draft.workExperience) > MAX_WORDS) { setError(t('Work / experience is required (max 500 words).')); return }
    if (!draft.localArea.trim() || countWords(draft.localArea) > MAX_WORDS) { setError(t('Local area understanding is required (max 500 words).')); return }
    setError('')
    onEdit(draft)
    setEditing(false)
  }

  return (
    <div style={cardBox}>
      <div style={cardTitle}><i className="bi bi-clipboard-check-fill" /> {t('Review Your Application')}</div>

      <ReviewSection title={t('Personal Details')} icon="person-fill">
        <KV k={t('Name')} v={v.name} />
        <KV k={t('Relation Name')} v={v.relation_name} />
        <KV k={t('Age / Gender')} v={[v.age, v.gender].filter(Boolean).join(' / ')} />
        <KV k={t('Mobile Number')} v={mobile} />
      </ReviewSection>

      <ReviewSection title={t('BJP Membership')} icon="card-heading">
        <KV k={t('Membership ID')} v={cur.membershipId} />
      </ReviewSection>

      <ReviewSection title={t('Voter & Booth')} icon="geo-alt-fill">
        <KV k={t('EPIC No')} v={v.epic_no} />
        <KV k={t('Assembly')} v={[v.assembly_name, v.assembly_no].filter(Boolean).join(' — ') || v.assembly_no} />
        <KV k={t('District')} v={v.district} />
        <KV k={t('Part / Booth')} v={[v.part_no, v.booth_name].filter(Boolean).join(' — ')} />
      </ReviewSection>

      {/* Local body + position — editable */}
      <ReviewSection title={t('Local Body & Position')} icon="building-fill">
        {!editing ? (
          <>
            <KV k={t('Local Body Type')} v={cur.bodyType === 'rural' ? t('Rural') : cur.bodyType === 'urban' ? t('Urban') : ''} />
            {cur.bodyType === 'urban' && (
              <>
                <KV k={t('Urban Body Type')} v={lb.urbanType} />
                <KV k={t('Local Body')} v={lb.urbanBody} />
                <KV k={t('Ward / Area')} v={lb.urbanWard} />
              </>
            )}
            {cur.bodyType === 'rural' && (
              <>
                <KV k={t('Panchayat Union')} v={lb.ruralUnion} />
                <KV k={t('Village Panchayat')} v={lb.ruralPanchayat} />
                <KV k={t('Ward / Area')} v={lb.ruralWard} />
              </>
            )}
            {cur.positionPrefs.filter(Boolean).map((p, i) => (
              <KV key={i} k={t(['1st Preference', '2nd Preference', '3rd Preference'][i])} v={p} />
            ))}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['rural', 'urban'].map((bt) => (
                <button key={bt} type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, bodyType: bt, localBody: emptyLocalBody(), positionPrefs: ['', '', ''] }))}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer',
                    background: draft.bodyType === bt ? 'rgba(46,204,113,0.10)' : 'var(--color-abyss)',
                    border: `1.5px solid ${draft.bodyType === bt ? 'var(--color-signal-mint)' : 'var(--color-graphite)'}`,
                    color: 'var(--color-chalk)', fontSize: 13, fontWeight: 600 }}>
                  {bt === 'rural' ? t('Rural') : t('Urban')}
                </button>
              ))}
            </div>

            {draft.bodyType === 'urban' && (
              <>
                <select style={controlStyle} value={draft.localBody.urbanType}
                  onChange={(e) => setLb({ urbanType: e.target.value, urbanBody: '' })}>
                  <option value="">{t('Select local body type')}</option>
                  {URBAN_BODY_TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
                </select>
                <select style={controlStyle} value={draft.localBody.urbanBody} disabled={!draft.localBody.urbanType}
                  onChange={(e) => setLb({ urbanBody: e.target.value })}>
                  <option value="">{t('Select local body')}</option>
                  {draftUrbanBodies.map((b) => <option key={b.label} value={b.name}>{b.label}</option>)}
                </select>
                <input style={controlStyle} type="text" placeholder={t('Enter Ward / Area')}
                  value={draft.localBody.urbanWard} onChange={(e) => setLb({ urbanWard: e.target.value })} />
              </>
            )}

            {draft.bodyType === 'rural' && (
              <>
                <input style={controlStyle} type="text" placeholder={t('Panchayat Union (Block)')}
                  value={draft.localBody.ruralUnion} onChange={(e) => setLb({ ruralUnion: e.target.value })} />
                <input style={controlStyle} type="text" placeholder={t('Village Panchayat')}
                  value={draft.localBody.ruralPanchayat} onChange={(e) => setLb({ ruralPanchayat: e.target.value })} />
                <input style={controlStyle} type="text" placeholder={t('Enter Ward / Area')}
                  value={draft.localBody.ruralWard} onChange={(e) => setLb({ ruralWard: e.target.value })} />
              </>
            )}

            {[0, 1, 2].map((idx) => (
              <select key={idx} style={controlStyle} value={draft.positionPrefs[idx]} onChange={(e) => setPref(idx, e.target.value)}>
                <option value="">{t(['1st Preference *', '2nd Preference (optional)', '3rd Preference (optional)'][idx])}</option>
                {availableFor(idx).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            ))}
          </div>
        )}
      </ReviewSection>

      {/* Social media — editable */}
      <ReviewSection title={t('Social Media')} icon="share-fill">
        {!editing ? (
          SOCIALS.map((s) => <KV key={s.key} k={t(s.label)} v={cur.social[s.key]} />)
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SOCIALS.map((s) => (
              <input key={s.key} style={controlStyle} type="url" placeholder={s.placeholder}
                value={draft.social[s.key] || ''} onChange={(e) => setSocial(s.key, e.target.value)} />
            ))}
          </div>
        )}
      </ReviewSection>

      {/* Work & experience — editable */}
      <ReviewSection title={t('Work & Experience')} icon="briefcase-fill">
        {!editing ? (
          <div style={{ fontSize: 13, color: 'var(--color-chalk)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{cur.workExperience}</div>
        ) : (
          <textarea style={{ ...controlStyle, resize: 'vertical', fontFamily: 'inherit' }} rows={4}
            value={draft.workExperience} onChange={(e) => setDraftField({ workExperience: e.target.value })} />
        )}
      </ReviewSection>

      {/* Local area understanding — editable */}
      <ReviewSection title={t('Local Area Understanding')} icon="chat-left-text-fill">
        {!editing ? (
          <div style={{ fontSize: 13, color: 'var(--color-chalk)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{cur.localArea}</div>
        ) : (
          <textarea style={{ ...controlStyle, resize: 'vertical', fontFamily: 'inherit' }} rows={4}
            value={draft.localArea} onChange={(e) => setDraftField({ localArea: e.target.value })} />
        )}
      </ReviewSection>

      {error && <div style={{ fontSize: 12, color: '#e74c3c' }}><i className="bi bi-exclamation-circle" /> {error}</div>}

      {active && (
        editing ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ ...primaryBtn(true), background: 'var(--color-graphite)' }}
              onClick={() => { setDraft(data); setEditing(false); setError('') }}>
              {t('Cancel')}
            </button>
            <button style={primaryBtn(true)} onClick={saveEdits}>
              <i className="bi bi-check-lg" /> {t('Save Changes')}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ ...primaryBtn(!disabled), background: 'var(--color-graphite)' }} disabled={disabled}
              onClick={() => { setDraft(data); setEditing(true) }}>
              <i className="bi bi-pencil-fill" /> {t('Edit')}
            </button>
            <button style={primaryBtn(!disabled)} disabled={disabled} onClick={onConfirm}>
              <i className="bi bi-send-fill" /> {t('Confirm & Submit')}
            </button>
          </div>
        )
      )}
    </div>
  )
}

// ── Submitted confirmation ─────────────────────────────────
function SubmittedMsg({ result, alreadyApplied }) {
  const { t } = useLang()
  return (
    <div style={{ ...cardBox, alignItems: 'center', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(46,204,113,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className="bi bi-check-circle-fill" style={{ fontSize: 34, color: 'var(--color-signal-mint)' }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-chalk)' }}>
        {alreadyApplied ? t('Application Already Submitted') : t('Application Submitted')}
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-ash)', lineHeight: 1.5 }}>
        {alreadyApplied
          ? t('You have already submitted an application with this mobile number. It is being reviewed by the Organisation.')
          : t('Your application will be reviewed by the Organisation. You will be contacted on your registered mobile number.')}
      </div>
      <div style={{ width: '100%', background: 'var(--color-abyss)', border: '1px solid var(--color-graphite)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <KV k={t('Application ID')} v={result.application_id} />
        <KV k={t('Submitted On')} v={fmtDateTime(result.submitted_at)} />
        <KV k={t('Mobile Number')} v={result.mobile} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-ash)' }}>
        <i className="bi bi-info-circle" /> {t('Please save your Application ID for future reference.')}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────
export default function ChatbotPage() {
  const { t } = useLang()
  const [chatState, setChatState] = useState(S.WELCOME)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sendHint, setSendHint] = useState('')
  const [otpResendIn, setOtpResendIn] = useState(0)
  const [appData, setAppData] = useState(emptyAppData())

  const sendHintTimer = useRef(null)
  const otpTimerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const initializedRef = useRef(false)
  const mobileRef = useRef('')
  const appDataRef = useRef(appData)

  useEffect(() => { appDataRef.current = appData }, [appData])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isTyping])
  useEffect(() => () => { if (otpTimerRef.current) clearInterval(otpTimerRef.current) }, [])

  const addMsg = useCallback((from, type, payload = {}) => {
    setMessages((prev) => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from, type, ...payload, ts: new Date(),
    }])
  }, [])

  const botSay = useCallback(async (text, delay = 450) => {
    setIsTyping(true)
    await sleep(delay)
    setIsTyping(false)
    addMsg('bot', 'text', { text })
  }, [addMsg])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    addMsg('bot', 'welcome_banner', {})
    setChatState(S.WELCOME)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patchData = (patch) => setAppData((prev) => ({ ...prev, ...patch }))

  const startOtpCountdown = (sec = 60) => {
    if (otpTimerRef.current) clearInterval(otpTimerRef.current)
    setOtpResendIn(sec)
    otpTimerRef.current = setInterval(() => {
      setOtpResendIn((s) => {
        if (s <= 1) { clearInterval(otpTimerRef.current); otpTimerRef.current = null; return 0 }
        return s - 1
      })
    }, 1000)
  }

  const stopOtpCountdown = () => {
    if (otpTimerRef.current) { clearInterval(otpTimerRef.current); otpTimerRef.current = null }
    setOtpResendIn(0)
  }

  // ── Flow handlers ────────────────────────────────────────
  const handleStart = async () => {
    addMsg('user', 'text', { text: t('Start Application') })
    setChatState(S.AWAIT_MOBILE)
    await botSay(t('Welcome! Let us begin. Please enter your 10-digit mobile number.'), 400)
  }

  const handleMobileSubmit = async () => {
    const mobile = inputValue.trim()
    if (!/^\d{10}$/.test(mobile)) { flashSendHint(t('Please enter a 10-digit mobile number')); return }
    addMsg('user', 'text', { text: maskMobile(mobile) })
    setInputValue('')
    setIsTyping(true)
    try {
      const res = await chat.sendOtp(mobile)
      setIsTyping(false)
      if (res?.success) {
        mobileRef.current = mobile
        await botSay(t('An OTP has been sent to {mobile}. Please enter it below.', { mobile: maskMobile(mobile) }), 300)
        setChatState(S.AWAIT_OTP)
        startOtpCountdown(60)
      } else {
        await botSay(`❌ ${res?.message || t('Could not send OTP. Please try again.')}`, 250)
      }
    } catch (err) {
      setIsTyping(false)
      await botSay(`❌ ${err?.message || t('Could not send OTP. Please try again.')}`, 250)
    }
  }

  const handleResendOtp = async () => {
    if (otpResendIn > 0 || isTyping) return
    const mobile = mobileRef.current
    if (!/^\d{10}$/.test(mobile || '')) return
    setIsTyping(true)
    try {
      const res = await chat.sendOtp(mobile)
      setIsTyping(false)
      if (res?.success) {
        await botSay(t('A new OTP has been sent to {mobile}.', { mobile: maskMobile(mobile) }), 250)
        startOtpCountdown(60)
      } else {
        if (res?.cooldown) startOtpCountdown(res.cooldown)
        await botSay(`⏳ ${res?.message || t('Please wait before requesting another OTP.')}`, 250)
      }
    } catch (err) {
      setIsTyping(false)
      await botSay(`⏳ ${err?.message || t('Please try again shortly.')}`, 250)
    }
  }

  const handleOtpSubmit = async () => {
    const otp = inputValue.trim()
    if (!/^\d{4,8}$/.test(otp)) { flashSendHint(t('Enter the OTP sent to your mobile')); return }
    addMsg('user', 'text', { text: '••••••' })
    setInputValue('')
    setIsTyping(true)
    try {
      const res = await chat.verifyOtp(mobileRef.current, otp)
      setIsTyping(false)
      if (res?.success) {
        stopOtpCountdown()
        // Repeat applicant — show their existing application and stop here.
        if (res.already_applied && res.application) {
          await botSay(t('✅ Mobile verified.'), 250)
          await botSay(t('ℹ️ You have already submitted an application with this mobile number.'), 400)
          addMsg('bot', 'submitted', { result: res.application, alreadyApplied: true })
          setChatState(S.SUBMITTED)
          return
        }
        await botSay(t('✅ Mobile verified! Please enter your BJP Membership ID.'), 300)
        setChatState(S.AWAIT_MEMBERSHIP)
      } else {
        await botSay(`❌ ${res?.message || t('Invalid OTP. Please try again.')}`, 250)
      }
    } catch (err) {
      setIsTyping(false)
      await botSay(`❌ ${err?.message || t('Invalid OTP. Please try again.')}`, 250)
    }
  }

  const handleMembershipSubmit = async () => {
    const membershipId = inputValue.trim()
    if (!membershipId) { flashSendHint(t('Please enter your BJP Membership ID')); return }
    patchData({ membershipId })
    addMsg('user', 'text', { text: membershipId })
    setInputValue('')
    await botSay(t('Thank you. Now please enter your EPIC Number (Voter ID).'), 350)
    await botSay(t('Format: letters followed by digits, e.g. ABC1234567'), 200)
    setChatState(S.AWAIT_EPIC)
  }

  const handleEpicSubmit = async () => {
    const epic = inputValue.trim().toUpperCase()
    if (!/^[A-Z]{2,4}\d{6,8}$/.test(epic)) { flashSendHint(t('Enter a valid EPIC number (e.g. ABC1234567)')); return }
    addMsg('user', 'text', { text: epic })
    setInputValue('')
    setIsTyping(true)
    try {
      const res = await chat.lookupVoter(epic)
      setIsTyping(false)
      if (res?.success && res.voter) {
        patchData({ epic, voter: res.voter })
        await botSay(t('✅ Voter found! Please confirm your details below.'), 250)
        addMsg('bot', 'voter_card', {})
        setChatState(S.CONFIRM_VOTER)
      } else {
        await botSay(`❌ ${res?.message || t('No voter found. Please re-check your EPIC number.')}`, 250)
      }
    } catch (err) {
      setIsTyping(false)
      await botSay(`❌ ${err?.message || t('Could not look up your voter details. Please try again.')}`, 250)
    }
  }

  const handleConfirmVoter = async () => {
    addMsg('user', 'text', { text: t('✓ Details confirmed') })
    await botSay(t('Great! Now, some Local Body Details. Please choose your local body type and fill in the details.'), 350)
    addMsg('bot', 'local_body', {})
    setChatState(S.LOCAL_BODY)
  }

  const handleRetryVoter = async () => {
    addMsg('user', 'text', { text: t('↩ Re-enter ID') })
    patchData({ voter: null, epic: '' })
    await botSay(t('Please enter your EPIC Number (Voter ID) again.'), 250)
    setChatState(S.AWAIT_EPIC)
  }

  const handleLocalBodySubmit = async ({ bodyType, localBody }) => {
    patchData({ bodyType, localBody, positionPrefs: ['', '', ''] })
    addMsg('user', 'text', { text: `${bodyType === 'rural' ? t('Rural') : t('Urban')} · ${localBodySummary(bodyType, localBody)}` })
    await botSay(t('Now select the Position to Contest with your preferences.'), 350)
    addMsg('bot', 'position', {})
    setChatState(S.POSITION)
  }

  const handlePositionSubmit = async (prefs) => {
    const padded = [prefs[0] || '', prefs[1] || '', prefs[2] || '']
    patchData({ positionPrefs: padded })
    addMsg('user', 'text', { text: prefs.join(' → ') })
    await botSay(t('Please add your social media profiles.'), 350)
    addMsg('bot', 'social', {})
    setChatState(S.SOCIAL)
  }

  const handleSocialSubmit = async (social) => {
    patchData({ social: { facebook: '', instagram: '', twitter: '', youtube: '', ...social } })
    addMsg('user', 'text', { text: t('{count} social link(s) added', { count: Object.keys(social).length }) })
    await botSay(t('Tell us about your Work / Experience (maximum 500 words).'), 350)
    addMsg('bot', 'work', {})
    setChatState(S.WORK)
  }

  const handleWorkSubmit = async (text) => {
    patchData({ workExperience: text })
    addMsg('user', 'text', { text: t('Work / experience added ✓') })
    await botSay(t('Local body understanding — tell us about your area, its key issues, and what you want to change (maximum 500 words).'), 400)
    addMsg('bot', 'local_area', {})
    setChatState(S.LOCAL_AREA)
  }

  const handleLocalAreaSubmit = async (text) => {
    patchData({ localArea: text })
    addMsg('user', 'text', { text: t('Local area understanding added ✓') })
    await botSay(t('Almost done! Please review all your details before submitting.'), 400)
    addMsg('bot', 'review', {})
    setChatState(S.REVIEW)
  }

  const handleReviewEdit = (updated) => setAppData(updated)

  const handleReviewConfirm = async () => {
    const d = appDataRef.current
    setChatState(S.SUBMITTING)
    addMsg('user', 'text', { text: t('✓ Confirm & Submit') })
    setIsTyping(true)
    try {
      const payload = {
        mobile: mobileRef.current,
        membership_id: d.membershipId,
        epic_no: d.epic,
        voter: d.voter,
        body_type: d.bodyType,
        local_body: localBodyPayload(d.bodyType, d.localBody),
        position_preferences: d.positionPrefs.filter(Boolean),
        social_media: d.social,
        work_experience: d.workExperience,
        local_area_understanding: d.localArea,
      }
      const res = await chat.submitApplication(payload)
      setIsTyping(false)
      if (res?.success) {
        await botSay(t('🎉 Submit Application — done!'), 250)
        addMsg('bot', 'submitted', {
          result: { application_id: res.application_id, submitted_at: res.submitted_at, mobile: res.mobile || mobileRef.current },
        })
        setChatState(S.SUBMITTED)
      } else {
        await botSay(`❌ ${res?.message || t('Could not submit your application. Please review and try again.')}`, 250)
        setChatState(S.REVIEW)
      }
    } catch (err) {
      setIsTyping(false)
      await botSay(`❌ ${err?.message || t('Could not submit your application. Please try again.')}`, 250)
      setChatState(S.REVIEW)
    }
  }

  const handleRestart = () => {
    stopOtpCountdown()
    mobileRef.current = ''
    setAppData(emptyAppData())
    setInputValue('')
    setMessages([])
    setChatState(S.WELCOME)
    addMsg('bot', 'welcome_banner', {})
  }

  // ── Input config ─────────────────────────────────────────
  const getInputCfg = () => {
    switch (chatState) {
      case S.AWAIT_MOBILE: return { type: 'tel', placeholder: t('Enter 10-digit mobile number'), maxLength: 10, inputMode: 'numeric' }
      case S.AWAIT_OTP: return { type: 'tel', placeholder: t('Enter OTP'), maxLength: 8, inputMode: 'numeric' }
      case S.AWAIT_MEMBERSHIP: return { type: 'text', placeholder: t('Enter your BJP Membership ID'), maxLength: 40 }
      case S.AWAIT_EPIC: return { type: 'text', placeholder: t('EPIC Number (e.g. ABC1234567)'), maxLength: 12 }
      default: return null
    }
  }

  const getIsSendDisabled = () => {
    if (isTyping) return true
    const val = inputValue.trim()
    if (chatState === S.AWAIT_MOBILE) return val.length !== 10
    if (chatState === S.AWAIT_OTP) return val.length < 4
    if (chatState === S.AWAIT_MEMBERSHIP) return !val
    if (chatState === S.AWAIT_EPIC) return !/^[A-Z]{2,4}\d{6,8}$/.test(val.toUpperCase())
    return !val
  }

  const handleInputChange = (e) => {
    let val = e.target.value
    if (chatState === S.AWAIT_EPIC) {
      val = val.toUpperCase().replace(/[^A-Z0-9]/g, '')
    } else if (chatState === S.AWAIT_MOBILE) {
      val = val.replace(/\D/g, '').slice(0, 10)
    } else if (chatState === S.AWAIT_OTP) {
      val = val.replace(/\D/g, '').slice(0, 8)
    }
    if (sendHint) setSendHint('')
    setInputValue(val)
  }

  const flashSendHint = (msg) => {
    setSendHint(msg)
    if (sendHintTimer.current) clearTimeout(sendHintTimer.current)
    sendHintTimer.current = setTimeout(() => setSendHint(''), 3000)
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (isTyping) return
    switch (chatState) {
      case S.AWAIT_MOBILE: await handleMobileSubmit(); break
      case S.AWAIT_OTP: await handleOtpSubmit(); break
      case S.AWAIT_MEMBERSHIP: await handleMembershipSubmit(); break
      case S.AWAIT_EPIC: await handleEpicSubmit(); break
      default: break
    }
  }

  // ── Render one message ───────────────────────────────────
  const renderMsgContent = (msg) => {
    const isLatest = messages[messages.length - 1]?.id === msg.id
    switch (msg.type) {
      case 'text': {
        const escapeHtml = (s) => String(s || '')
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        const safeHtml = escapeHtml(msg.text || '').replace(/\*(.*?)\*/g, '<strong>$1</strong>')
        return <span dangerouslySetInnerHTML={{ __html: safeHtml }} />
      }
      case 'welcome_banner':
        return <WelcomeBannerMsg onStart={handleStart} />
      case 'voter_card':
        return (
          <VoterCardMsg
            voter={appData.voter}
            active={isLatest && chatState === S.CONFIRM_VOTER}
            onConfirm={handleConfirmVoter}
            onRetry={handleRetryVoter}
            disabled={isTyping}
          />
        )
      case 'local_body':
        return (
          <LocalBodyMsg
            active={isLatest && chatState === S.LOCAL_BODY}
            initial={{ bodyType: appData.bodyType, localBody: appData.localBody }}
            onSubmit={handleLocalBodySubmit}
            disabled={isTyping}
          />
        )
      case 'position':
        return (
          <PositionMsg
            active={isLatest && chatState === S.POSITION}
            bodyType={appData.bodyType}
            initial={appData.positionPrefs}
            onSubmit={handlePositionSubmit}
            disabled={isTyping}
          />
        )
      case 'social':
        return (
          <SocialMediaMsg
            active={isLatest && chatState === S.SOCIAL}
            initial={appData.social}
            onSubmit={handleSocialSubmit}
            disabled={isTyping}
          />
        )
      case 'work':
        return (
          <LongTextMsg
            active={isLatest && chatState === S.WORK}
            title="Work / Experience"
            icon="briefcase-fill"
            prompt="Describe your work and experience (max 500 words)."
            initial={appData.workExperience}
            onSubmit={handleWorkSubmit}
            disabled={isTyping}
          />
        )
      case 'local_area':
        return (
          <LongTextMsg
            active={isLatest && chatState === S.LOCAL_AREA}
            title="Local Body Understanding"
            icon="chat-left-text-fill"
            prompt="Tell us about your area — key issues and what you want to change (max 500 words)."
            initial={appData.localArea}
            onSubmit={handleLocalAreaSubmit}
            disabled={isTyping}
          />
        )
      case 'review':
        return (
          <ReviewMsg
            active={isLatest && (chatState === S.REVIEW || chatState === S.SUBMITTING)}
            data={appData}
            mobile={mobileRef.current}
            onConfirm={handleReviewConfirm}
            onEdit={handleReviewEdit}
            disabled={isTyping || chatState === S.SUBMITTING}
          />
        )
      case 'submitted':
        return <SubmittedMsg result={msg.result} alreadyApplied={msg.alreadyApplied} />
      default:
        return <span>{msg.text || ''}</span>
    }
  }

  const inputCfg = getInputCfg()
  const wideTypes = ['voter_card', 'welcome_banner', 'local_body', 'position', 'social', 'work', 'local_area', 'review', 'submitted']
  const isSubmitted = chatState === S.SUBMITTED

  return (
    <div className="chatbot-app bjp-theme">
      <div className="chatbot-fullpage">
        <div className="chatbot-container">
          <header className="chat-header">
            <div className="chat-header-avatar">
              <img src="/bjp_logo.svg" alt="BJP" onError={(e) => { e.target.style.display = 'none' }} />
            </div>
            <div className="chat-header-info">
              <div className="chat-header-name">{t('BJP Local Body Application')}</div>
              <div className="chat-header-status">
                {chatState === S.SUBMITTING ? (
                  <><span className="status-dot-pulsing" /> {t('Submitting application...')}</>
                ) : isSubmitted ? (
                  <><span className="status-dot-green" /> {t('Completed')}</>
                ) : (
                  <><span className="status-dot-green" /> {t('Application in progress')}</>
                )}
              </div>
            </div>
            <div className="chat-header-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button className="chat-header-btn" title={t('Restart')}
                onClick={() => { if (window.confirm(t('Restart the application from the beginning?'))) handleRestart() }}>
                <i className="bi bi-arrow-clockwise" />
              </button>
            </div>
          </header>

          <main className="chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`msg-row ${msg.from}`}>
                <div className="msg-avatar" aria-hidden="true">
                  {msg.from === 'bot'
                    ? <img src="/bjp_logo.svg" alt="BJP" onError={(e) => { e.target.onerror = null; e.target.src = '/bjp_logo.png' }} />
                    : <i className="bi bi-person-fill" />}
                </div>
                <div className={`msg-bubble ${wideTypes.includes(msg.type) ? 'wide' : ''}`}>
                  {renderMsgContent(msg)}
                  <div className="msg-time">{fmtTime(msg.ts)}</div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="msg-row bot">
                <div className="msg-avatar" aria-hidden="true">
                  <img src="/bjp_logo.svg" alt="BJP" onError={(e) => { e.target.onerror = null; e.target.src = '/bjp_logo.png' }} />
                </div>
                <div className="typing-bubble" role="status" aria-label={t('Bot is typing')}>
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} style={{ height: 8 }} />
          </main>

          {/* Resend OTP bar */}
          {chatState === S.AWAIT_OTP && (
            <div className="otp-resend-bar">
              {otpResendIn > 0 ? (
                <span className="otp-resend-wait">
                  <i className="bi bi-clock-history" /> {t('Resend OTP in {seconds}s', { seconds: otpResendIn })}
                </span>
              ) : (
                <button type="button" className="otp-resend-btn" onClick={handleResendOtp} disabled={isTyping}>
                  <i className="bi bi-arrow-clockwise" /> {t('Resend OTP')}
                </button>
              )}
            </div>
          )}

          {/* Input area — only render when there is an input bar or a done bar to show */}
          {(inputCfg || isSubmitted) && (
            <footer className="chat-input-area">
              {inputCfg ? (
                <form className="chat-form" onSubmit={handleSubmit} style={{ position: 'relative' }}>
                  {sendHint && <div className="send-hint-bubble" role="status">{sendHint}</div>}
                  <div className="chat-input-wrapper">
                    <input
                      className="chat-input"
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
                      placeholder={inputCfg.placeholder}
                      aria-label={inputCfg.placeholder}
                      type={inputCfg.type}
                      maxLength={inputCfg.maxLength}
                      inputMode={inputCfg.inputMode}
                      autoComplete="off"
                      disabled={isTyping}
                      autoFocus
                    />
                  </div>
                  <button type="submit" className={`chat-send-btn${getIsSendDisabled() ? ' not-ready' : ''}`}
                    aria-label={t('Send')} title={t('Send')}>
                    <i className="bi bi-send-fill" />
                  </button>
                </form>
              ) : (
                <div className="chat-form done-bar">
                  <div className="chat-input-wrapper">
                    <span className="done-status">
                      <i className="bi bi-shield-fill-check text-success" /> {t('Application Submitted')}
                    </span>
                  </div>
                  <button className="chat-send-btn menu-btn" onClick={handleRestart} title={t('New Application')}>
                    <i className="bi bi-plus-lg" />
                  </button>
                </div>
              )}
            </footer>
          )}
        </div>
      </div>
    </div>
  )
}
