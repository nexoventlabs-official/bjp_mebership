import React, { useState, useEffect, useRef, useCallback } from 'react'
import { chat } from '../api'
import '../styles/chatbot.css'
import { useLang } from '../i18n/LanguageContext'
import {
  ALL_DISTRICTS, RURAL_POSITIONS, URBAN_POSITIONS, URBAN_BODY_TYPES,
  corporationsForDistrict, municipalitiesForDistrict, townPanchayatsForDistrict,
  wardsForCorporation, districtPanchayatWards, unionsForDistrict, blocksForDistrict,
  panchayatsForBlock, positionsFor
} from '../data/localBodies.js'
import html2canvas from 'html2canvas'
import QRCode from 'qrcode'


// ── Flow states ────────────────────────────────────────────
const S = {
  WELCOME:          'WELCOME',
  AWAIT_MOBILE:     'AWAIT_MOBILE',
  AWAIT_OTP:        'AWAIT_OTP',
  AWAIT_MEMBERSHIP: 'AWAIT_MEMBERSHIP',
  AWAIT_EPIC:       'AWAIT_EPIC',
  CONFIRM_VOTER:    'CONFIRM_VOTER',
  DISTRICT:         'DISTRICT',
  PHOTO_UPLOAD:     'PHOTO_UPLOAD',
  LOCAL_BODY:       'LOCAL_BODY',
  POSITION:         'POSITION',
  SOCIAL:           'SOCIAL',
  VIDEO_UPLOAD:     'VIDEO_UPLOAD',
  WORK:             'WORK',
  LOCAL_AREA:       'LOCAL_AREA',
  SHORT_TEXTS:      'SHORT_TEXTS',
  DOC_UPLOAD:       'DOC_UPLOAD',
  REVIEW:           'REVIEW',
  SUBMITTING:       'SUBMITTING',
  SUBMITTED:        'SUBMITTED',
}

const MAX_WORDS = 500
const SHORT_MAX_WORDS = 150
const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Shrink a photo in the browser before upload: cap the longest side at 1280px
// and re-encode as JPEG (~0.8). A multi-MB phone photo becomes a couple hundred
// KB, so it uploads in about a second. Non-images / errors return the original.
const compressImage = (file) => new Promise((resolve) => {
  if (!file || !file.type || !file.type.startsWith('image/')) return resolve(file)
  try {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1280
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width >= height) { height = Math.round((height * MAX) / width); width = MAX }
        else { width = Math.round((width * MAX) / height); height = MAX }
      }
      try {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => {
          if (!blob || blob.size >= file.size) return resolve(file)
          const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg'
          resolve(new File([blob], name, { type: 'image/jpeg' }))
        }, 'image/jpeg', 0.8)
      } catch { resolve(file) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  } catch { resolve(file) }
})
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
  photoUrl: '',
  videoUrl: '',
  epic: '',
  voter: null,
  contestDistrict: '',
  bodyType: '',
  localBody: emptyLocalBody(),
  positionPrefs: ['', '', ''],
  social: { facebook: '', instagram: '', twitter: '', youtube: '' },
  workExperience: '',
  localArea: '',
  devPriorities: '',
  grievancePlan: '',
  documentUrl: '',
})


// ── Session persistence (survive page refresh) + inactivity logout ──
const STORAGE_KEY = 'bjp_lb_session'
// Sliding session window: valid for 30 min from the LAST activity. Every save
// and every user action refreshes savedAt, so an active user stays logged in;
// 30 min of inactivity expires the session (auto-logout).
const INACTIVITY_MS = 30 * 60 * 1000 // 30 minutes

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || !data.savedAt || Date.now() - data.savedAt > INACTIVITY_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

function saveSession(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }))
  } catch { /* ignore quota/serialization errors */ }
}

// Refresh only the last-activity timestamp (sliding expiry) without touching data.
function touchSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    data.savedAt = Date.now()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* ignore */ }
}

function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

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
  return {
    type: 'rural',
    panchayat_union: lb.ruralUnion || undefined,
    village_panchayat: lb.ruralPanchayat || undefined,
    ward: lb.ruralWard || undefined
  }
}

function localBodyComplete(bodyType, lb, ruralPosition = '') {
  if (bodyType === 'urban') return !!(lb.urbanType && lb.urbanBody && lb.urbanWard && String(lb.urbanWard).trim())
  if (bodyType === 'rural') {
    if (ruralPosition === 'District Panchayat Ward Member') return !!(lb.ruralWard && String(lb.ruralWard).trim())
    if (ruralPosition === 'Panchayat Union Ward Member') return !!(lb.ruralUnion && lb.ruralWard && String(lb.ruralWard).trim())
    if (ruralPosition === 'Village Panchayat President') return !!(lb.ruralUnion && lb.ruralPanchayat)
    if (ruralPosition === 'Village Panchayat Ward Member') return !!(lb.ruralUnion && lb.ruralPanchayat && lb.ruralWard && String(lb.ruralWard).trim())
    return !!(lb.ruralUnion || lb.ruralPanchayat || lb.ruralWard)
  }
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

// ── Welcome back banner card ────────────────────────────────
function WelcomeBackBannerMsg({ name, subtitle }) {
  const { t } = useLang()
  const formattedName = name ? String(name).trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : ''

  return (
    <div className="welcome-banner welcome-back-banner">
      <img src="/banner.png" alt="BJP Tamil Nadu" className="banner-img" loading="lazy"
        onError={(e) => { e.target.style.display = 'none' }} />
      <div className="banner-content">
        <h2>{formattedName ? t('👋 Welcome back, {name}!', { name: formattedName }) : t('👋 Welcome back!')}</h2>
        <p>{t(subtitle || 'Here is your submitted application for the BJP Tamil Nadu Local Body Elections 2026.')}</p>
        <div className="welcome-back-status-badge">
          <i className="bi bi-shield-fill-check" /> {t('Application Submitted & Verified')}
        </div>
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
  flex: 1,
  width: '100%', padding: '11px 14px', marginTop: 4,
  background: enabled ? 'linear-gradient(135deg, #FF6600 0%, #E65C00 100%)' : '#FFC299',
  color: '#FFFFFF', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700,
  cursor: enabled ? 'pointer' : 'not-allowed',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  boxShadow: enabled ? '0 4px 14px rgba(255, 102, 0, 0.35)' : 'none',
  transition: 'all 0.2s ease',
  whiteSpace: 'normal',
  lineHeight: 1.35,
  textAlign: 'center',
  boxSizing: 'border-box',
  minWidth: 0,
})

const secondaryBtn = (enabled = true) => ({
  flex: 1,
  width: '100%', padding: '11px 14px', marginTop: 4,
  background: '#F3F4F6',
  color: '#1F2937',
  border: '1.5px solid #D1D5DB', borderRadius: 10, fontSize: 13.5, fontWeight: 700,
  cursor: enabled ? 'pointer' : 'not-allowed',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  transition: 'all 0.2s ease',
  whiteSpace: 'normal',
  lineHeight: 1.35,
  textAlign: 'center',
  boxSizing: 'border-box',
  minWidth: 0,
})



const cardBox = {
  width: '100%', background: 'var(--color-carbon)', border: '1px solid var(--color-graphite)',
  borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 14,
}
const cardTitle = { fontSize: 13, fontWeight: 700, color: 'var(--color-chalk)', display: 'flex', alignItems: 'center', gap: 8 }

// ── BJP Membership Card (Optional + Online Apply Link) ──────
function MembershipCardMsg({ active, onSubmit, disabled }) {
  const { t } = useLang()
  const [val, setVal] = useState('')

  return (
    <div style={cardBox}>
      <div style={cardTitle}><i className="bi bi-card-heading text-saffron" /> {t('BJP Membership ID')} *</div>
      <div style={{ fontSize: 12, color: 'var(--color-ash)', lineHeight: 1.4 }}>
        {t('Your BJP Membership ID is required. Please enter it to continue.')}
      </div>

      <div style={{ background: 'var(--color-abyss)', padding: 12, borderRadius: 10, border: '1px solid var(--color-graphite)' }}>
        <a
          href="https://membership.bjp.org/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13, color: 'var(--color-signal-mint)', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <i className="bi bi-box-arrow-up-right" />
          {t("Aren't a BJP member? Click here to join BJP Membership")}
        </a>
      </div>

      {active && (
        <>
          <input
            style={controlStyle}
            type="text"
            value={val}
            placeholder={t('Enter BJP Membership ID')}
            onChange={(e) => setVal(e.target.value)}
          />

          <div className="card-action-btns" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, width: '100%' }}>

            <button
              style={primaryBtn(Boolean(val.trim()) && !disabled)}
              onClick={() => val.trim() && onSubmit(val.trim(), false)}
              disabled={!val.trim() || disabled}
            >
              {t('Continue')} <i className="bi bi-arrow-right" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Candidate Passport Size Photo Upload (Max 15MB) ────────
function PhotoUploadMsg({ active, initial, onSubmit, disabled }) {
  const { t } = useLang()
  const [photoFile, setPhotoFile] = useState(null)
  const [preview, setPreview] = useState(initial?.photoUrl || '')
  const [error, setError] = useState('')

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError(t('Please select a valid image file (JPG, PNG, WebP).'))
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setError(t('File size exceeds 15 MB limit. Please select a smaller photo.'))
      return
    }
    setPhotoFile(file)
    setError('')
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleContinue = () => {
    if (!preview && !photoFile) return
    onSubmit({ photoFile, photoUrl: preview })
  }

  return (
    <div style={cardBox}>
      <div style={cardTitle}>
        <i className="bi bi-person-bounding-box text-saffron" />
        {t('Candidate Passport Size Photo (Max 15 MB)')}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-ash)', lineHeight: 1.4 }}>
        {t('Upload a clear, formal passport size candidate profile photo (max 15 MB).')}
      </div>

      {preview && (
        <div style={{ textAlign: 'center', margin: '8px 0' }}>
          <img
            src={preview}
            alt="Candidate Passport Preview"
            style={{ width: 110, height: 130, borderRadius: 8, objectFit: 'cover', border: '2.5px solid #FF6600', boxShadow: '0 4px 10px rgba(255, 102, 0, 0.25)' }}
          />
          <div style={{ background: '#ECFDF5', border: '1px solid #10B981', padding: '4px 12px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#059669', fontWeight: 700, marginTop: 6 }}>
            <i className="bi bi-check-circle-fill" /> {t('Passport Photo Ready')}
          </div>
        </div>
      )}

      {active && (
        <input
          type="file"
          accept="image/*"
          disabled={disabled}
          onChange={handleFile}
          style={controlStyle}
        />
      )}

      {error && (
        <div style={{ fontSize: 12, color: '#e74c3c' }}>
          <i className="bi bi-exclamation-circle" /> {error}
        </div>
      )}

      {active && (
        <button
          style={primaryBtn(Boolean(preview) && !disabled)}
          disabled={!preview || disabled}
          onClick={handleContinue}
        >
          {t('Continue')} <i className="bi bi-arrow-right" />
        </button>
      )}



    </div>
  )
}

// ── Contesting District Step (Step 8) ──────────────────────────────
function DistrictMsg({ active, initial, voterDistrict, onSubmit, disabled }) {
  const { t } = useLang()
  const [district, setDistrict] = useState(initial || voterDistrict || 'Chennai')

  useEffect(() => {
    if (initial) setDistrict(initial)
  }, [initial])

  const handleSelectChange = (e) => {
    const newDist = e.target.value
    setDistrict(newDist)
    if (newDist && onSubmit) {
      onSubmit({ district: newDist })
    }
  }

  return (
    <div style={cardBox}>
      <div style={cardTitle}>
        <i className="bi bi-pin-map-fill" style={{ color: 'var(--color-saffron)' }} /> {t('Contest District')}
      </div>
      <p style={{ fontSize: 13, color: 'var(--color-ash)', marginBottom: 12 }}>
        {voterDistrict ? t('Your voter district is {district}. You can confirm it or select ANY district you wish to contest from.', { district: voterDistrict })
          : t('Select the district from which you plan to contest the local body election.')}
      </p>

      <div>
        <span style={fieldLabel}>{t('District to Contest From')}<span style={{ color: '#e74c3c' }}> *</span></span>
        <select style={controlStyle} value={district} disabled={disabled}
          onChange={handleSelectChange}>
          <option value="">{t('Select district')}</option>
          {ALL_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {active && (
        <button style={primaryBtn(Boolean(district) && !disabled)} disabled={!district || disabled}
          onClick={() => district && onSubmit({ district })}>
          {t('Confirm District')} <i className="bi bi-arrow-right" />
        </button>
      )}
    </div>
  )
}

// ── Local Body step (7 Position Flows with Cascading Dropdowns) ─────
function LocalBodyMsg({ active, contestDistrict, initial, onSubmit, disabled }) {
  const { t } = useLang()
  const [bodyType, setBodyType] = useState(initial?.bodyType || 'urban')

  // Urban local body selections
  const [urbanBodyType, setUrbanBodyType] = useState(initial?.localBody?.urbanType || '')
  const [urbanBodyName, setUrbanBodyName] = useState(initial?.localBody?.urbanBody || '')
  const [urbanWard, setUrbanWard] = useState(initial?.localBody?.urbanWard || '')

  // Rural local body selections
  const [ruralPosition, setRuralPosition] = useState(initial?.positionPrefs?.[0] || RURAL_POSITIONS[0])
  const [ruralUnion, setRuralUnion] = useState(initial?.localBody?.ruralUnion || '')
  const [ruralBlock, setRuralBlock] = useState(initial?.localBody?.ruralUnion || '')
  const [ruralPanchayat, setRuralPanchayat] = useState(initial?.localBody?.ruralPanchayat || '')
  const [ruralWard, setRuralWard] = useState(initial?.localBody?.ruralWard || '')

  const dist = contestDistrict || 'Chennai'

  // Reset dependent selections if contestDistrict changes
  useEffect(() => {
    setUrbanBodyName('')
    setUrbanWard('')
    setRuralUnion('')
    setRuralBlock('')
    setRuralPanchayat('')
    setRuralWard('')
  }, [contestDistrict])

  // Options dynamically populated for contestDistrict
  const corps = corporationsForDistrict(dist)
  const munis = municipalitiesForDistrict(dist)
  const tps = townPanchayatsForDistrict(dist)
  const corpWards = urbanBodyType === 'Corporation' ? wardsForCorporation(urbanBodyName) : []

  const distWards = districtPanchayatWards(dist)
  const unions = unionsForDistrict(dist)
  const blocks = blocksForDistrict(dist)
  const panchayats = panchayatsForBlock(ruralBlock)

  const isReady = () => {
    if (bodyType === 'urban') {
      return Boolean(urbanBodyType && urbanBodyName && String(urbanWard).trim())
    } else {
      if (ruralPosition === 'District Panchayat Ward Member') return Boolean(String(ruralWard).trim())
      if (ruralPosition === 'Panchayat Union Ward Member') return Boolean(ruralUnion && String(ruralWard).trim())
      if (ruralPosition === 'Village Panchayat President') return Boolean(ruralBlock && ruralPanchayat)
      if (ruralPosition === 'Village Panchayat Ward Member') return Boolean(ruralBlock && ruralPanchayat && String(ruralWard).trim())
      return false
    }
  }

  const handleSubmit = () => {
    if (!isReady()) return
    if (bodyType === 'urban') {
      const autoPos = urbanBodyType === 'Corporation' ? 'Corporation Ward Member'
        : urbanBodyType === 'Municipality' ? 'Municipality Ward Member'
        : 'Town Panchayat Ward Member'
      onSubmit({
        bodyType: 'urban',
        localBody: { urbanType: urbanBodyType, urbanBody: urbanBodyName, urbanWard },
        positionPrefs: [autoPos, '', '']
      })
    } else {
      const unionVal = (ruralPosition === 'Village Panchayat President' || ruralPosition === 'Village Panchayat Ward Member')
        ? ruralBlock
        : ruralUnion
      onSubmit({
        bodyType: 'rural',
        localBody: {
          ruralUnion: unionVal,
          ruralPanchayat: ruralPosition.includes('Village') ? ruralPanchayat : '',
          ruralWard: ruralPosition === 'Village Panchayat President' ? '' : ruralWard
        },
        positionPrefs: [ruralPosition, '', '']
      })
    }
  }

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
      <div style={cardTitle}>
        <i className="bi bi-geo-alt-fill" /> {t('Local Body & Position Details')}
        {dist && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,102,0,0.15)', color: '#FF6600', marginLeft: 8 }}>
            📍 {dist}
          </span>
        )}
      </div>

      <div>
        <span style={fieldLabel}>{t('Local body type')}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          {typeBtn('urban', t('Urban Local Body'), t('Corporations, Municipalities, Town Panchayats'))}
          {typeBtn('rural', t('Rural Local Body'), t('District Panchayat, Unions, Village Panchayats'))}
        </div>
      </div>

      {/* URBAN FLOWS (Flow 1, Flow 2, Flow 3) */}
      {bodyType === 'urban' && (
        <>
          <div>
            <span style={fieldLabel}>{t('Urban Body Type')}</span>
            <select style={controlStyle} value={urbanBodyType} disabled={!active}
              onChange={(e) => { setUrbanBodyType(e.target.value); setUrbanBodyName(''); setUrbanWard('') }}>
              <option value="">{t('Select urban body type')}</option>
              {URBAN_BODY_TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
            </select>
          </div>

          {/* FLOW 1: Corporation */}
          {urbanBodyType === 'Corporation' && (
            <>
              <div>
                <span style={fieldLabel}>{t('Corporation Name ({district})', { district: dist })}</span>
                <select style={controlStyle} value={urbanBodyName} disabled={!active}
                  onChange={(e) => { setUrbanBodyName(e.target.value); setUrbanWard('') }}>
                  <option value="">{t('Select Corporation')}</option>
                  {corps.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <span style={fieldLabel}>{t('Ward Number')}</span>
                <select style={controlStyle} value={urbanWard} disabled={!active || !urbanBodyName}
                  onChange={(e) => setUrbanWard(e.target.value)}>
                  <option value="">{urbanBodyName ? t('Select Ward') : t('Select Corporation first')}</option>
                  {corpWards.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </>
          )}

          {/* FLOW 2: Municipality */}
          {urbanBodyType === 'Municipality' && (
            <>
              <div>
                <span style={fieldLabel}>{t('Municipality Name ({district})', { district: dist })}</span>
                <select style={controlStyle} value={urbanBodyName} disabled={!active}
                  onChange={(e) => setUrbanBodyName(e.target.value)}>
                  <option value="">{t('Select Municipality')}</option>
                  {munis.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <span style={fieldLabel}>{t('Ward Number / Name')}</span>
                <input style={controlStyle} type="text" value={urbanWard} disabled={!active}
                  placeholder={t('e.g. Ward 12')}
                  onChange={(e) => setUrbanWard(e.target.value)} />
              </div>
            </>
          )}

          {/* FLOW 3: Town Panchayat */}
          {urbanBodyType === 'Town Panchayat' && (
            <>
              <div>
                <span style={fieldLabel}>{t('Town Panchayat Name ({district})', { district: dist })}</span>
                <select style={controlStyle} value={urbanBodyName} disabled={!active}
                  onChange={(e) => setUrbanBodyName(e.target.value)}>
                  <option value="">{t('Select Town Panchayat')}</option>
                  {tps.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
                </select>
              </div>
              <div>
                <span style={fieldLabel}>{t('Ward Number / Name')}</span>
                <input style={controlStyle} type="text" value={urbanWard} disabled={!active}
                  placeholder={t('e.g. Ward 5')}
                  onChange={(e) => setUrbanWard(e.target.value)} />
              </div>
            </>
          )}
        </>
      )}

      {/* RURAL FLOWS (Flow 4, Flow 5, Flow 6, Flow 7) */}
      {bodyType === 'rural' && (
        <>
          <div>
            <span style={fieldLabel}>{t('Select Position to Contest')}</span>
            <select style={controlStyle} value={ruralPosition} disabled={!active}
              onChange={(e) => { setRuralPosition(e.target.value); setRuralWard(''); setRuralUnion(''); setRuralBlock(''); setRuralPanchayat('') }}>
              {RURAL_POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
            </select>
          </div>

          {/* FLOW 4: District Panchayat Ward Member */}
          {ruralPosition === 'District Panchayat Ward Member' && (
            <div>
              <span style={fieldLabel}>{t('District Panchayat Ward ({district})', { district: dist })}</span>
              <select style={controlStyle} value={ruralWard} disabled={!active}
                onChange={(e) => setRuralWard(e.target.value)}>
                <option value="">{t('Select Ward')}</option>
                {distWards.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          )}

          {/* FLOW 5: Panchayat Union Ward Member */}
          {ruralPosition === 'Panchayat Union Ward Member' && (
            <>
              <div>
                <span style={fieldLabel}>{t('Panchayat Union ({district})', { district: dist })}</span>
                <select style={controlStyle} value={ruralUnion} disabled={!active}
                  onChange={(e) => setRuralUnion(e.target.value)}>
                  <option value="">{t('Select Panchayat Union')}</option>
                  {unions.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <span style={fieldLabel}>{t('Ward Number / Name')}</span>
                <input style={controlStyle} type="text" value={ruralWard} disabled={!active}
                  placeholder={t('e.g. Ward 4')}
                  onChange={(e) => setRuralWard(e.target.value)} />
              </div>
            </>
          )}

          {/* FLOW 6 & FLOW 7: Village Panchayat President / Ward Member */}
          {(ruralPosition === 'Village Panchayat President' || ruralPosition === 'Village Panchayat Ward Member') && (
            <>
              <div>
                <span style={fieldLabel}>{t('Block ({district})', { district: dist })}</span>
                <select style={controlStyle} value={ruralBlock} disabled={!active}
                  onChange={(e) => { setRuralBlock(e.target.value); setRuralPanchayat('') }}>
                  <option value="">{t('Select Block')}</option>
                  {blocks.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <span style={fieldLabel}>{t('Village Panchayat')}</span>
                <select style={controlStyle} value={ruralPanchayat} disabled={!active || !ruralBlock}
                  onChange={(e) => setRuralPanchayat(e.target.value)}>
                  <option value="">{ruralBlock ? t('Select Village Panchayat') : t('Select Block first')}</option>
                  {panchayats.map((vp) => <option key={vp} value={vp}>{vp}</option>)}
                </select>
              </div>
              {ruralPosition === 'Village Panchayat Ward Member' && (
                <div>
                  <span style={fieldLabel}>{t('Ward Number / Name')}</span>
                  <input style={controlStyle} type="text" value={ruralWard} disabled={!active}
                    placeholder={t('e.g. Ward 2')}
                    onChange={(e) => setRuralWard(e.target.value)} />
                </div>
              )}
            </>
          )}
        </>
      )}

      {active && (
        <button style={primaryBtn(isReady() && !disabled)} disabled={!isReady() || disabled}
          onClick={handleSubmit}>
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
  // 1st preference is a required dropdown; 2nd & 3rd are optional free text.
  const [pref1, setPref1] = useState((initial && initial[0]) || '')
  const [pref2, setPref2] = useState((initial && initial[1]) || '')
  const [pref3, setPref3] = useState((initial && initial[2]) || '')

  const ready = !!pref1

  const handleContinue = () => {
    if (!ready) return
    const chosen = [pref1, pref2.trim(), pref3.trim()].filter(Boolean)
    onSubmit(chosen)
  }

  return (
    <div style={cardBox}>
      <div style={cardTitle}><i className="bi bi-trophy-fill" /> {t('Position to Contest')}</div>
      <div style={{ fontSize: 12, color: 'var(--color-ash)' }}>
        {t('Choose your 1st preference. 2nd and 3rd preferences are optional.')}
      </div>

      <div>
        <span style={fieldLabel}>{t('1st Preference')}<span style={{ color: '#e74c3c' }}> *</span></span>
        <select style={controlStyle} value={pref1} disabled={!active} onChange={(e) => setPref1(e.target.value)}>
          <option value="">{t('Select a position')}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div>
        <span style={fieldLabel}>{t('2nd Preference')} <span style={{ color: 'var(--color-ash)', fontWeight: 400 }}>({t('optional')})</span></span>
        <input style={controlStyle} type="text" value={pref2} disabled={!active}
          placeholder={t('Type your 2nd preference (optional)')}
          onChange={(e) => setPref2(e.target.value)} />
      </div>

      <div>
        <span style={fieldLabel}>{t('3rd Preference')} <span style={{ color: 'var(--color-ash)', fontWeight: 400 }}>({t('optional')})</span></span>
        <input style={controlStyle} type="text" value={pref3} disabled={!active}
          placeholder={t('Type your 3rd preference (optional)')}
          onChange={(e) => setPref3(e.target.value)} />
      </div>

      {active && (
        <button style={primaryBtn(ready && !disabled)} disabled={!ready || disabled} onClick={handleContinue}>
          {t('Continue')} <i className="bi bi-arrow-right" />
        </button>
      )}
    </div>
  )
}

// ── Social media (optional, free text — any handle or link) ─
const SOCIALS = [
  { key: 'facebook', label: 'Facebook', icon: 'facebook', placeholder: 'Facebook page, username or link' },
  { key: 'instagram', label: 'Instagram', icon: 'instagram', placeholder: 'Instagram handle or link' },
  { key: 'twitter', label: 'Twitter / X', icon: 'twitter-x', placeholder: 'Twitter / X handle or link' },
  { key: 'youtube', label: 'YouTube', icon: 'youtube', placeholder: 'YouTube channel or link' },
]

function SocialMediaMsg({ active, initial, onSubmit, disabled }) {
  const { t } = useLang()
  const [vals, setVals] = useState(initial || { facebook: '', instagram: '', twitter: '', youtube: '' })
  const [error, setError] = useState('')
  const set = (k, v) => setVals((prev) => ({ ...prev, [k]: v }))

  const handleContinue = () => {
    const filled = SOCIALS.map((s) => [s.key, (vals[s.key] || '').trim()]).filter(([, v]) => v)
    setError('')
    onSubmit(Object.fromEntries(filled))
  }

  return (
    <div style={cardBox}>
      <div style={cardTitle}><i className="bi bi-share-fill text-saffron" /> {t('Add Your Social Media')} ({t('Optional')})</div>
      <div style={{ fontSize: 12, color: 'var(--color-ash)' }}>
        {t('Add your social media profile URLs (Optional).')}
      </div>

      {SOCIALS.map((s) => (
        <div key={s.key}>
          <span style={fieldLabel}><i className={`bi bi-${s.icon}`} style={{ marginRight: 6 }} />{t(s.label)}</span>
          <input style={controlStyle} type="text" value={vals[s.key]} disabled={!active} placeholder={s.placeholder}
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

// ── Candidate Pitch Video Upload (URL or MP4 file, max 100MB) ──
function VideoUploadMsg({ active, initial, onSubmit, disabled }) {
  const { t } = useLang()
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl || '')
  const [videoFile, setVideoFile] = useState(initial?.videoFile || null)
  const [fileName, setFileName] = useState(initial?.videoFileName || '')
  const [error, setError] = useState('')

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 100 * 1024 * 1024) {
      setError(t('Video size exceeds 100 MB limit. Please select a smaller video.'))
      return
    }
    setVideoFile(file)
    setFileName(file.name)
    setError('')
  }

  const handleContinue = () => {
    const finalUrl = videoUrl.trim()
    if (finalUrl && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      setError(t('Please enter a valid video link (starting with https://).'))
      return
    }
    setError('')
    onSubmit({ videoUrl: finalUrl, videoFile, videoFileName: fileName })
  }

  return (
    <div style={cardBox}>
      <div style={cardTitle}>
        <i className="bi bi-camera-video-fill text-saffron" />
        {t('Candidate Pitch Video (1 Min / Max 100 MB)')} ({t('Optional')})
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-ash)', lineHeight: 1.4 }}>
        {t('Provide your 1-minute candidate pitch video. You can paste a video link (YouTube, Instagram Reels, Google Drive) OR upload an MP4 file (Max 100 MB).')}
      </div>

      <div>
        <span style={fieldLabel}><i className="bi bi-link-45deg me-1" />{t('Option A: Paste Video Link')}</span>
        <input
          style={controlStyle}
          type="url"
          value={videoUrl}
          disabled={!active}
          placeholder="https://youtube.com/shorts/... or https://instagram.com/reel/..."
          onChange={(e) => { setVideoUrl(e.target.value); if (error) setError('') }}
        />
      </div>

      {active && (
        <div>
          <span style={fieldLabel}><i className="bi bi-cloud-arrow-up-fill me-1" />{t('Option B: Or Upload MP4 Video File (Max 100 MB)')}</span>
          <input
            type="file"
            accept="video/mp4,video/x-m4v,video/*"
            disabled={disabled}
            onChange={handleFileUpload}
            style={controlStyle}
          />
        </div>
      )}

      {fileName && (
        <div style={{ fontSize: 12, color: 'var(--color-chalk)', background: 'var(--color-abyss)', padding: 10, borderRadius: 8, border: '1px solid #FF6600', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="bi bi-file-earmark-play-fill text-saffron" style={{ fontSize: 18 }} />
          <div>
            <div style={{ fontWeight: 600 }}>{fileName}</div>
            <div style={{ fontSize: 11, color: '#10B981' }}>{t('Pitch Video File Ready (Will upload on submit)')}</div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: '#e74c3c' }}>
          <i className="bi bi-exclamation-circle" /> {error}
        </div>
      )}

      {active && (
        <div className="card-action-btns" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, width: '100%' }}>

          <button
            style={secondaryBtn(!disabled)}
            onClick={() => onSubmit({ videoUrl: '', videoFile: null, videoFileName: '' })}
            disabled={disabled}
          >
            {t('Skip')}
          </button>

          <button
            style={primaryBtn(!disabled)}
            disabled={disabled}
            onClick={handleContinue}
          >
            {t('Continue')} <i className="bi bi-arrow-right" />
          </button>
        </div>
      )}
    </div>
  )
}



// ── Long text step (work / experience, local area) ─────────
function LongTextMsg({ active, title, icon, prompt, expectText, initial, onSubmit, disabled }) {
  const { t } = useLang()
  const [text, setText] = useState(initial || '')
  const [showInfo, setShowInfo] = useState(false)
  const words = countWords(text)
  const over = words > MAX_WORDS
  const ready = words > 0 && !over

  return (
    <div style={cardBox}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={cardTitle}>
          <i className={`bi bi-${icon} text-saffron`} /> {t(title)}
        </div>
        {expectText && (
          <button
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            title={t('Click for political guidance')}
            style={{
              background: showInfo ? '#FF6600' : '#F3F4F6',
              color: showInfo ? '#FFFFFF' : '#FF6600',
              border: '1.5px solid #FF6600',
              borderRadius: '50%',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14,
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 6px rgba(255, 102, 0, 0.2)',
            }}
          >
            <i className="bi bi-info-circle-fill" />
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--color-ash)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{t(prompt)}</span>
        {expectText && (
          <span
            onClick={() => setShowInfo(!showInfo)}
            style={{ fontSize: 11, color: '#FF6600', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
          >
            {t('(Click ℹ️ for guidance)')}
          </span>
        )}
      </div>

      {showInfo && expectText && (
        <div style={{
          background: 'rgba(255, 102, 0, 0.08)',
          border: '1.5px solid #FF6600',
          borderRadius: 10,
          padding: 12,
          fontSize: 12,
          color: 'var(--color-chalk)',
          lineHeight: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <div style={{ fontWeight: 700, color: '#FF6600', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="bi bi-lightbulb-fill" /> {t('What We Expect From Your End')}
          </div>
          <div style={{ color: 'var(--color-chalk)', fontSize: 12 }}>{t(expectText)}</div>
        </div>
      )}

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

// ── Two free-text fields (max 150 words each) ─────────────
function ShortTextsMsg({ active, initial, onSubmit, disabled }) {
  const { t } = useLang()
  const [devP, setDevP] = useState(initial?.devPriorities || '')
  const [grievP, setGrievP] = useState(initial?.grievancePlan || '')
  const [showInfo1, setShowInfo1] = useState(false)
  const [showInfo2, setShowInfo2] = useState(false)
  const [error, setError] = useState('')

  const words1 = countWords(devP)
  const words2 = countWords(grievP)
  const over1 = words1 > SHORT_MAX_WORDS
  const over2 = words2 > SHORT_MAX_WORDS

  const handleContinue = () => {
    if (over1 || over2) {
      setError(t('Each text field must be 150 words or fewer.'))
      return
    }
    setError('')
    onSubmit({ devPriorities: devP.trim(), grievancePlan: grievP.trim() })
  }

  return (
    <div style={cardBox}>
      <div style={cardTitle}>
        <i className="bi bi-card-checklist text-saffron" />
        {t('Additional Ward & Grievance Details (Max 150 Words Each)')} ({t('Optional')})
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-ash)', lineHeight: 1.4 }}>
        {t('Fill in your key development priorities and constituent grievance plan (optional, max 150 words each).')}
      </div>

      {/* Field 1: Development Priorities */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <span style={fieldLabel}>
            <i className="bi bi-list-stars text-saffron me-1" />
            {t('1. Key Ward / Panchayat Development Priorities (Max 150 words)')}
          </span>
          <button
            type="button"
            onClick={() => setShowInfo1(!showInfo1)}
            style={{
              background: showInfo1 ? '#FF6600' : '#F3F4F6', color: showInfo1 ? '#FFFFFF' : '#FF6600',
              border: '1.5px solid #FF6600', borderRadius: '50%', width: 24, height: 24, flexShrink: 0, marginTop: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 700, fontSize: 12,
            }}
          >
            <i className="bi bi-info-circle-fill" />
          </button>
        </div>

        {showInfo1 && (
          <div style={{ background: 'rgba(255,102,0,0.08)', border: '1.5px solid #FF6600', borderRadius: 8, padding: 10, fontSize: 12, color: 'var(--color-chalk)' }}>
            <strong style={{ color: '#FF6600' }}>💡 {t('What We Expect From Your End')}:</strong><br />
            {t('Outline 3 to 5 core infrastructure or civic development goals for your ward (e.g. roads, clean water, youth center, sports facility).')}
          </div>
        )}

        <textarea
          value={devP}
          disabled={!active}
          onChange={(e) => { setDevP(e.target.value); if (error) setError('') }}
          rows={3}
          placeholder={t('Type key development priorities here...')}
          style={{ ...controlStyle, resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
        />
        <div style={{ fontSize: 11, color: over1 ? '#e74c3c' : 'var(--color-ash)', textAlign: 'right' }}>
          {words1} / {SHORT_MAX_WORDS} {t('words')}
        </div>
      </div>

      {/* Field 2: Grievance Plan */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <span style={fieldLabel}>
            <i className="bi bi-chat-left-dots-fill text-saffron me-1" />
            {t('2. Public Grievance Redressal Plan (Max 150 words)')}
          </span>
          <button
            type="button"
            onClick={() => setShowInfo2(!showInfo2)}
            style={{
              background: showInfo2 ? '#FF6600' : '#F3F4F6', color: showInfo2 ? '#FFFFFF' : '#FF6600',
              border: '1.5px solid #FF6600', borderRadius: '50%', width: 24, height: 24, flexShrink: 0, marginTop: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 700, fontSize: 12,
            }}
          >
            <i className="bi bi-info-circle-fill" />
          </button>
        </div>


        {showInfo2 && (
          <div style={{ background: 'rgba(255,102,0,0.08)', border: '1.5px solid #FF6600', borderRadius: 8, padding: 10, fontSize: 12, color: 'var(--color-chalk)' }}>
            <strong style={{ color: '#FF6600' }}>💡 {t('What We Expect From Your End')}:</strong><br />
            {t('Describe how you will establish regular constituent outreach, weekly grievance camps, and fast municipal escalation.')}
          </div>
        )}

        <textarea
          value={grievP}
          disabled={!active}
          onChange={(e) => { setGrievP(e.target.value); if (error) setError('') }}
          rows={3}
          placeholder={t('Type grievance redressal plan here...')}
          style={{ ...controlStyle, resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
        />
        <div style={{ fontSize: 11, color: over2 ? '#e74c3c' : 'var(--color-ash)', textAlign: 'right' }}>
          {words2} / {SHORT_MAX_WORDS} {t('words')}
        </div>
      </div>

      {error && <div style={{ fontSize: 12, color: '#e74c3c' }}><i className="bi bi-exclamation-circle" /> {error}</div>}

      {active && (
        <div className="card-action-btns" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, width: '100%' }}>
          <button style={secondaryBtn(!disabled)} onClick={() => onSubmit({ devPriorities: '', grievancePlan: '' })} disabled={disabled}>
            {t('Skip')}
          </button>
          <button style={primaryBtn(!disabled)} disabled={disabled} onClick={handleContinue}>
            {t('Continue')} <i className="bi bi-arrow-right" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Candidate Document Upload (PDF or DOCX, max 15MB) ───────
function DocUploadMsg({ active, initial, onSubmit, disabled }) {

  const { t } = useLang()
  const [docFile, setDocFile] = useState(initial?.docFile || null)
  const [fileName, setFileName] = useState(initial?.docFileName || '')
  const [error, setError] = useState('')

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validExts = ['.pdf', '.docx', '.doc']
    const isDoc = validExts.some((ext) => file.name.toLowerCase().endsWith(ext))
    if (!isDoc) {
      setError(t('Please select a valid PDF or DOCX document file.'))
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setError(t('Document file size exceeds 15 MB limit.'))
      return
    }
    setDocFile(file)
    setFileName(file.name)
    setError('')
  }

  const handleContinue = () => {
    onSubmit({ docFile, docFileName: fileName })
  }

  return (
    <div style={cardBox}>
      <div style={cardTitle}>
        <i className="bi bi-file-earmark-pdf-fill text-saffron" />
        {t('Candidate Profile / Vision Document Upload (PDF or DOCX)')} ({t('Optional')})
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-ash)', lineHeight: 1.4 }}>
        {t('Upload supporting candidate document, resume, or civic vision paper (PDF or DOCX format, max 15 MB).')}
      </div>

      {active && (
        <input
          type="file"
          accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={disabled}
          onChange={handleFile}
          style={controlStyle}
        />
      )}

      {fileName && (
        <div style={{ fontSize: 12, color: 'var(--color-chalk)', background: 'var(--color-abyss)', padding: 10, borderRadius: 8, border: '1px solid #FF6600', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="bi bi-file-earmark-check-fill text-saffron" style={{ fontSize: 18 }} />
          <div>
            <div style={{ fontWeight: 600 }}>{fileName}</div>
            <div style={{ fontSize: 11, color: '#10B981' }}>{t('Document Ready (Will upload on submit)')}</div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: '#e74c3c' }}>
          <i className="bi bi-exclamation-circle" /> {error}
        </div>
      )}

      {active && (
        <div className="card-action-btns" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, width: '100%' }}>

          <button style={secondaryBtn(!disabled)} onClick={() => onSubmit({ docFile: null, docFileName: '' })} disabled={disabled}>
            {t('Skip')}
          </button>
          <button style={primaryBtn(!disabled)} disabled={disabled} onClick={handleContinue}>
            {t('Continue')} <i className="bi bi-arrow-right" />
          </button>
        </div>
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

  const saveEdits = () => {
    const pos = draft.positionPrefs[0] || ''
    if (!draft.bodyType || !localBodyComplete(draft.bodyType, draft.localBody, pos)) { setError(t('Please complete all local body fields.')); return }
    if (!pos) { setError(t('Position preference is required.')); return }
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
        <KV k={t('Voter District')} v={v.district} />
        <KV k={t('Contesting District')} v={cur.contestDistrict || v.district} />
        <KV k={t('Part / Booth')} v={[v.part_no, v.booth_name].filter(Boolean).join(' — ')} />
      </ReviewSection>

      {/* Local body + position — editable */}
      <ReviewSection title={t('Local Body & Position')} icon="building-fill">
        {!editing ? (
          <>
            <KV k={t('Position to Contest')} v={cur.positionPrefs[0]} />
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
                {lb.ruralUnion && <KV k={t('Panchayat Union / Block')} v={lb.ruralUnion} />}
                {lb.ruralPanchayat && <KV k={t('Village Panchayat')} v={lb.ruralPanchayat} />}
                {lb.ruralWard && <KV k={t('Ward / Area')} v={lb.ruralWard} />}
              </>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <span style={fieldLabel}>{t('Contesting District')}</span>
              <select style={controlStyle} value={draft.contestDistrict || v.district || ''}
                onChange={(e) => setDraftField({ contestDistrict: e.target.value })}>
                {ALL_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {['urban', 'rural'].map((bt) => (
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
                  onChange={(e) => setLb({ urbanType: e.target.value, urbanBody: '', urbanWard: '' })}>
                  <option value="">{t('Select local body type')}</option>
                  {URBAN_BODY_TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
                </select>
                <input style={controlStyle} type="text" placeholder={t('Enter Local Body Name')}
                  value={draft.localBody.urbanBody} onChange={(e) => setLb({ urbanBody: e.target.value })} />
                <input style={controlStyle} type="text" placeholder={t('Enter Ward / Area')}
                  value={draft.localBody.urbanWard} onChange={(e) => setLb({ urbanWard: e.target.value })} />
              </>
            )}

            {draft.bodyType === 'rural' && (
              <>
                <select style={controlStyle} value={draft.positionPrefs[0] || RURAL_POSITIONS[0]}
                  onChange={(e) => setPref(0, e.target.value)}>
                  {RURAL_POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                </select>
                <input style={controlStyle} type="text" placeholder={t('Panchayat Union / Block')}
                  value={draft.localBody.ruralUnion} onChange={(e) => setLb({ ruralUnion: e.target.value })} />
                <input style={controlStyle} type="text" placeholder={t('Village Panchayat')}
                  value={draft.localBody.ruralPanchayat} onChange={(e) => setLb({ ruralPanchayat: e.target.value })} />
                <input style={controlStyle} type="text" placeholder={t('Enter Ward / Area')}
                  value={draft.localBody.ruralWard} onChange={(e) => setLb({ ruralWard: e.target.value })} />
              </>
            )}
          </div>
        )}
      </ReviewSection>

      <ReviewSection title={t('Media, Priorities & Documents')} icon="file-earmark-pdf-fill">
        <KV k={t('Candidate Photo')} v={cur.photoUrl ? t('Uploaded ✓') : t('Not Provided')} />
        <KV k={t('Pitch Video')} v={cur.videoUrl ? t('Provided ✓') : t('Not Provided')} />
        <KV k={t('Development Priorities')} v={cur.devPriorities ? cur.devPriorities : t('Not Provided')} />
        <KV k={t('Grievance Plan')} v={cur.grievancePlan ? cur.grievancePlan : t('Not Provided')} />
        <KV k={t('Supporting Document (PDF/DOCX)')} v={cur.documentUrl ? t('Uploaded ✓') : t('Not Provided')} />
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
          <div className="card-action-btns" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, width: '100%' }}>
            <button style={{ ...secondaryBtn(true), flex: '1 1 110px' }}
              onClick={() => { setDraft(data); setEditing(false); setError('') }}>
              {t('Cancel')}
            </button>
            <button style={{ ...primaryBtn(true), flex: '2 1 160px' }} onClick={saveEdits}>
              <i className="bi bi-check-lg" /> {t('Save Changes')}
            </button>
          </div>
        ) : (
          <div className="card-action-btns" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, width: '100%' }}>
            <button style={{ ...secondaryBtn(!disabled), flex: '1 1 110px' }} disabled={disabled}
              onClick={() => { setDraft(data); setEditing(true) }}>
              <i className="bi bi-pencil-fill" /> {t('Edit')}
            </button>
            <button style={{ ...primaryBtn(!disabled), flex: '2 1 160px' }} disabled={disabled} onClick={onConfirm}>
              <i className="bi bi-send-fill" /> {t('Confirm & Submit')}
            </button>
          </div>
        )
      )}

    </div>
  )
}

// ── Submitted confirmation + Organiser Get In Touch (One-time message) ──
function SubmittedMsg({ result, alreadyApplied, appData }) {
  const { t, lang } = useLang()
  const initialSentMsg = result?.organiser_message || null
  const [sentMsg, setSentMsg] = useState(initialSentMsg)
  const [orgMsg, setOrgMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [fetchedApp, setFetchedApp] = useState(null)
  const [showPosterModal, setShowPosterModal] = useState(false)
  const [showQrScanModal, setShowQrScanModal] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [downloading, setDownloading] = useState(false)
  const posterRef = useRef(null)

  const activeApp = fetchedApp || result || {}

  const candName = activeApp.voter?.name || result?.voter?.name || appData?.voter?.name || 'Candidate'
  const photoUrl = activeApp.photo_url || activeApp.photoUrl || result?.photo_url || result?.photoUrl || appData?.photoUrl || appData?.photo_url || appData?.photoPreview || activeApp.voter?.photo || result?.voter?.photo || ''
  const candidateImg = photoUrl && photoUrl.trim() ? photoUrl : 'https://raw.githubusercontent.com/twbs/icons/main/icons/person-circle.svg'
  const epicNo = activeApp.epic_no || activeApp.voter?.epic_no || result?.epic_no || appData?.epic || result?.voter?.epic_no || ''
  
  const bodyType = activeApp.body_type || result?.body_type || appData?.bodyType || ''
  const lb = activeApp.local_body || result?.local_body || appData?.localBody || {}
  
  const getLbSummary = () => {
    if (typeof lb === 'string') return lb
    if (bodyType === 'urban' || lb.type === 'urban' || lb.local_body_type) {
      const type = lb.local_body_type || lb.urbanType || 'Town Panchayat'
      const body = lb.local_body || lb.urbanBody || ''
      const ward = lb.ward || lb.urbanWard || ''
      return [type, body, ward ? `Ward ${ward}` : ''].filter(Boolean).join(' - ')
    }
    const union = lb.panchayat_union || lb.ruralUnion || ''
    const panchayat = lb.village_panchayat || lb.ruralPanchayat || ''
    const ward = lb.ward || lb.ruralWard || ''
    return [union, panchayat, ward ? `Ward ${ward}` : ''].filter(Boolean).join(' - ')
  }

  const lbSummary = getLbSummary() || 'Tamil Nadu Local Body'
  const posPrefs = activeApp.position_preferences || result?.position_preferences || appData?.positionPrefs || []
  const firstPos = posPrefs[0] || 'Local Body Candidate'

  const targetAppId = activeApp.application_id || result?.application_id || appData?.applicationId || ''

  const getPublicOrigin = () => {
    if (typeof window !== 'undefined' && window.location.origin) {
      const orig = window.location.origin
      if (!orig.includes('localhost') && !orig.includes('127.0.0.1') && !orig.includes('file:')) {
        return orig
      }
    }
    return 'https://bjp-membership.vercel.app'
  }

  const verifyLinkUrl = `${getPublicOrigin()}/verify?app_id=${encodeURIComponent(targetAppId)}&lang=${encodeURIComponent(lang)}`

  useEffect(() => {
    if (targetAppId) {
      chat.getApplication(targetAppId)
        .then((res) => {
          const app = res?.application || res?.data?.application
          if (app) setFetchedApp(app)
        })
        .catch(() => {})

      QRCode.toDataURL(verifyLinkUrl, { margin: 1, width: 140, color: { dark: '#0F172A', light: '#FFFFFF' } })
        .then(setQrUrl)
        .catch(() => {})
    }
  }, [targetAppId, lang, verifyLinkUrl])

  const handleDownloadPoster = async () => {
    if (!posterRef.current) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(posterRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f76201',
      })
      const image = canvas.toDataURL('image/png')
      const link = document.createElement('a')

      link.href = image
      link.download = `BJP_Candidate_Card_${result?.application_id || '2026'}.png`
      link.click()
    } catch (err) {
      console.error('[Download Card Error]', err)
    } finally {
      setDownloading(false)
    }
  }

  const handleSendOrganiserMsg = async () => {
    if (!orgMsg.trim()) return
    setSending(true)
    setError('')
    try {
      const res = await chat.sendOrganiserMessage({
        mobile: result.mobile,
        application_id: result.application_id,
        message: orgMsg.trim(),
      })
      setSending(false)
      if (res?.success) {
        setSentMsg({
          text: orgMsg.trim(),
          sent_at: new Date(),
        })
      } else {
        setError(res?.message || t('Failed to send message to organiser.'))
      }
    } catch (err) {
      setSending(false)
      setError(err?.message || t('Failed to send message to organiser.'))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      
      {/* Application Submitted & Candidate Application Card Box */}
      <div style={{ ...cardBox, display: 'flex', flexDirection: 'column', gap: 14 }}>
        
        {/* Submitted Status Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6 }}>
          <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(46,204,113,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="bi bi-check-circle-fill" style={{ fontSize: 30, color: 'var(--color-signal-mint)' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-chalk)' }}>
            {alreadyApplied ? t('Application Already Submitted') : t('Application Submitted')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-ash)', lineHeight: 1.5 }}>
            {alreadyApplied
              ? t('You have already submitted an application with this mobile number. It is being reviewed by the Organisation.')
              : t('Your application will be reviewed by the Organisation. You will be contacted on your registered mobile number.')}
          </div>
        </div>
        {/* Card Header & Language Toggle Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 320, margin: '0 auto -6px auto' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-ash)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <i className="bi bi-translate" /> Card Language / மொழி:
          </span>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 2, border: '1px solid rgba(255,255,255,0.15)' }}>
            <button
              type="button"
              onClick={() => setLang('en')}
              style={{
                background: lang === 'en' ? '#f76201' : 'transparent',
                color: '#FFF', border: 'none', borderRadius: 12, padding: '3px 10px',
                fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('ta')}
              style={{
                background: lang === 'ta' ? '#f76201' : 'transparent',
                color: '#FFF', border: 'none', borderRadius: 12, padding: '3px 10px',
                fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              தமிழ்
            </button>
          </div>
        </div>

        {/* 9:16 Portrait Candidate Application Poster Card (BJP Saffron #f76201 Theme) */}
        <div className="bjp-poster-916-card" style={{
          width: '100%',
          maxWidth: 320,
          margin: '0 auto',
          aspectRatio: '9 / 16',
          background: 'linear-gradient(165deg, #f76201 0%, #d85400 100%)',
          border: '3px solid #f76201',
          borderRadius: 20,
          boxShadow: '0 12px 36px rgba(247, 98, 1, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '14px 12px',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
          color: '#FFFFFF',
        }}>
          {/* Top Tricolor Accent Line */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 5,
            background: 'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 50%, #00A650 50%, #00A650 100%)',
            zIndex: 10
          }} />

          {/* Watermark Lotus Background */}
          <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.08, pointerEvents: 'none' }}>
            <svg viewBox="0 0 141 151" width="220" height="220">
              <path fill="#FFFFFF" d="m19.4 88.3c-1.1-1.8-0.9-3.4-0.3-5.1 1.4-3.7 4.2-6.2 7.3-8.3 0.4-0.2 0.7-0.5 0.9-0.6-2.1-1.5-4.5-2.8-6.5-4.6-5.1-4.6-7.9-10.6-9.8-17-1.8-5.9-2.4-12.1-2.4-18.2 0-7.7-1.7-15.1-5.3-21.9-1.1-2-2.4-3.9-3.7-5.9 1.4-1.3 3.2-1.5 5-1.5 5.7-0.1 10.9 1.6 15.8 4.4 5.1 3 9.2 7 12.6 11.7 0.2 0.3 0.5 0.6 0.8 1 2.3-7.3-1.5-12.6-5.3-18 2-1.2 4.1-0.9 6.1-0.6 7.6 1.1 13.7 5 18.7 10.6 1.9 2.1 3.4 4.5 5 6.8 0.3 0.3 0.5 0.7 0.5 0.8 4.3-7.2 8.5-14.4 13-22 4.8 6.1 7.8 12.6 10.8 18.9 2.4-2.7 4.8-5.5 7.4-8 3.8-3.6 8.2-6.3 13.2-7.7 2.7-0.7 4.2-0.7 7 0.3-3.4 6.1-4.8 12.5-3.1 19.3 1.4-1.9 2.7-4 4.3-5.8 5.3-6.2 11.7-10.4 19.9-11.7 2.4-0.4 4.9-0.6 7.2 0.1 0.7 0.2 1.4 0.6 2.3 1-0.4 0.5-0.7 0.8-1 1.1-4.4 5-7.3 10.6-7.5 17.4-0.1 3.8 0.2 7.6 0.5 11.4 0.6 8-0.1 15.7-3.5 23.1-2.4 5.3-5.8 9.9-10.1 13.9-0.1 0.1-0.3 0.3-0.4 0.4-0.1 0.1-0.1 0.1-0.1 0.2 4.2 3.8 8 7.7 6 14.3-0.8-0.5-1.4-0.9-2-1.3-1.6-1.1-3.3-1.3-5.1-0.7-2.9 0.8-5.3 2.5-7.5 4.4-3 2.7-6.4 4.5-10.4 5.2-3.8 0.7-7.6 0.5-11.3-1-0.4-0.2-0.9-0.2-1.3-0.1-6.3 1.4-10.8 7-10.7 13 0.1 6.8-0.3 13.6-2.1 20.2-0.7 2.4-1.7 4.6-2.6 6.9q2.7-0.3 5.7-0.6c0.6-0.1 1.2-0.2 1.8 0 1 0.2 1.3 1 1.1 2-0.2 1.1-1.1 2-1.9 2-2.7-0.1-5.4-0.2-8.1-0.1-1.7 0-1.9-1.4-2.6-2.3-0.7-0.8 0-1.3 0.4-1.9 2-2.9 2.9-6.2 3.3-9.7 0.6-4.9 0.9-9.8 1.2-14.7 0.1-1.5-0.4-2-2.1-2.3 0 0.5-0.1 1-0.1 1.5 0 5.4 0 10.7-1.1 16-0.9 4.1-2.2 7.9-5.3 10.9-3.2 3.1-7.2 4.1-11.5 4-2.1-0.1-4.3-0.3-6.4-0.8-2.1-0.5-2.4-2.2-0.8-3.7 1.6-1.6 3.6-1.9 5.8-1.8 2.9 0.2 5.9 0.5 8.8 0.8 1 0.1 1.5-0.3 2-1.1 3.2-4.7 4.7-10 5.2-15.6 0.3-4.4 0.1-8.8-1.6-13-1.2-2.9-3-5.2-5.8-6.8-1.9-1.1-3.7-2.3-5.6-3.4-0.3-0.2-0.8-0.3-1-0.2-4 1.9-8 1.4-12 0.3-2.8-0.8-5.2-2.2-7.5-3.9-2.5-1.8-5.2-3.2-8.2-3.7-2.1-0.1 4.0 0.4-6 1.7zm37.5 47.4c-1.1 0.1-2.2 0.3-3.2 0.4-1.5 0.1-2.7-0.5-4.2 0-0.2 0.1-0.9 0.3-0.9 0.6 0 0.2 0.2 0.4 0.8 0.6 1.3 0.4 2.2 0.1 5.4 0 1.1 0 1.8-0.5 2.1-1.6z"/>
            </svg>
          </div>

          {/* Poster Top Banner Header (Pure White Panel) */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: 14, padding: '7px 10px', textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)', zIndex: 1
          }}>
            <div style={{ width: 34, height: 34, background: '#FFF7ED', borderRadius: '50%', border: '1px solid #FFE4D6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2, flexShrink: 0 }}>
              <svg viewBox="0 0 141 151" width="26" height="26">
                <path fill="#000000" d="m19.4 88.3c-1.1-1.8-0.9-3.4-0.3-5.1 1.4-3.7 4.2-6.2 7.3-8.3 0.4-0.2 0.7-0.5 0.9-0.6-2.1-1.5-4.5-2.8-6.5-4.6-5.1-4.6-7.9-10.6-9.8-17-1.8-5.9-2.4-12.1-2.4-18.2 0-7.7-1.7-15.1-5.3-21.9-1.1-2-2.4-3.9-3.7-5.9 1.4-1.3 3.2-1.5 5-1.5 5.7-0.1 10.9 1.6 15.8 4.4 5.1 3 9.2 7 12.6 11.7 0.2 0.3 0.5 0.6 0.8 1 2.3-7.3-1.5-12.6-5.3-18 2-1.2 4.1-0.9 6.1-0.6 7.6 1.1 13.7 5 18.7 10.6 1.9 2.1 3.4 4.5 5 6.8 0.3 0.3 0.5 0.7 0.5 0.8 4.3-7.2 8.5-14.4 13-22 4.8 6.1 7.8 12.6 10.8 18.9 2.4-2.7 4.8-5.5 7.4-8 3.8-3.6 8.2-6.3 13.2-7.7 2.7-0.7 4.2-0.7 7 0.3-3.4 6.1-4.8 12.5-3.1 19.3 1.4-1.9 2.7-4 4.3-5.8 5.3-6.2 11.7-10.4 19.9-11.7 2.4-0.4 4.9-0.6 7.2 0.1 0.7 0.2 1.4 0.6 2.3 1-0.4 0.5-0.7 0.8-1 1.1-4.4 5-7.3 10.6-7.5 17.4-0.1 3.8 0.2 7.6 0.5 11.4 0.6 8-0.1 15.7-3.5 23.1-2.4 5.3-5.8 9.9-10.1 13.9-0.1 0.1-0.3 0.3-0.4 0.4-0.1 0.1-0.1 0.1-0.1 0.2 4.2 3.8 8 7.7 6 14.3-0.8-0.5-1.4-0.9-2-1.3-1.6-1.1-3.3-1.3-5.1-0.7-2.9 0.8-5.3 2.5-7.5 4.4-3 2.7-6.4 4.5-10.4 5.2-3.8 0.7-7.6 0.5-11.3-1-0.4-0.2-0.9-0.2-1.3-0.1-6.3 1.4-10.8 7-10.7 13 0.1 6.8-0.3 13.6-2.1 20.2-0.7 2.4-1.7 4.6-2.6 6.9q2.7-0.3 5.7-0.6c0.6-0.1 1.2-0.2 1.8 0 1 0.2 1.3 1 1.1 2-0.2 1.1-1.1 2-1.9 2-2.7-0.1-5.4-0.2-8.1-0.1-1.7 0-1.9-1.4-2.6-2.3-0.7-0.8 0-1.3 0.4-1.9 2-2.9 2.9-6.2 3.3-9.7 0.6-4.9 0.9-9.8 1.2-14.7 0.1-1.5-0.4-2-2.1-2.3 0 0.5-0.1 1-0.1 1.5 0 5.4 0 10.7-1.1 16-0.9 4.1-2.2 7.9-5.3 10.9-3.2 3.1-7.2 4.1-11.5 4-2.1-0.1-4.3-0.3-6.4-0.8-2.1-0.5-2.4-2.2-0.8-3.7 1.6-1.6 3.6-1.9 5.8-1.8 2.9 0.2 5.9 0.5 8.8 0.8 1 0.1 1.5-0.3 2-1.1 3.2-4.7 4.7-10 5.2-15.6 0.3-4.4 0.1-8.8-1.6-13-1.2-2.9-3-5.2-5.8-6.8-1.9-1.1-3.7-2.3-5.6-3.4-0.3-0.2-0.8-0.3-1-0.2-4 1.9-8 1.4-12 0.3-2.8-0.8-5.2-2.2-7.5-3.9-2.5-1.8-5.2-3.2-8.2-3.7-2.1-0.1 4.0 0.4-6 1.7zm37.5 47.4c-1.1 0.1-2.2 0.3-3.2 0.4-1.5 0.1-2.7-0.5-4.2 0-0.2 0.1-0.9 0.3-0.9 0.6 0 0.2 0.2 0.4 0.8 0.6 1.3 0.4 2.2 0.1 5.4 0 1.1 0 1.8-0.5 2.1-1.6z"/>
                <path fill="#00a650" d="m24.1 82.9c0.1 0.1 0.2 0.2 0.4 0.3 0.6-0.1 1.2-0.2 1.8-0.2 3.4-0.1 5.5 1.7 9.2 3.6 1.5 0.8 3.9 2 7.1 2.8 1.8 0.5 7.2 1.9 8.5 0 0.5-0.7-0.1-1.1 0.3-3.5 0.3-2 0.9-3.5 1-3.8 0.4-0.8 1-2 2.1-3.2-0.2-0.1-0.5-0.2-0.7-0.3-2.7-1.1-5.4-2.2-8.2-3.3-0.6-0.2-1.3-0.3-1.9-0.1-3.4 1.1-6.8 1.6-10.4 0.6-0.5-0.1-1.2-0.1-1.6 0.2-1.7 1.1-3.4 2.2-4.9 3.5-1.1 0.9-1.8 2.3-2.7 3.4z"/>
                <path fill="#00a650" d="m70 99.2c1 0.5 2.4 1 3.8 0.5 1.7-0.7 1.5-2.3 3.5-4.5 0.7-0.7 2-2.1 5.4-3.5 1.2-0.5 2.3-1.1 3.3-2 2.9-2.6 3-7.2 0.3-9.7-0.6-0.6-1.2-0.7-2-0.4-7.9 2.9-15.9 2.7-23.8 0.1-1.3-0.4-2-0.1-2.8 0.9-2 2.6-2 6.8 0.1 9.2 1.1 1.3 2.7 2.1 4 3.2 1.9 1.7 3.2 1.4 4.9 2.7 1.6 1.2 2.7 2.6 3.3 3.5z"/>
                <path fill="#00a650" d="m90.6 80.3c0.6 0.9 1 1.8 1.3 2.7 0.1 0.5 0.5 2 0.2 4-0.3 2-1 2.2-0.8 2.9 0.5 1.8 5.4 2.6 9.5 1.5 2.2-0.6 3.8-1.7 6.7-3.6 2.8-1.9 3-2.5 4.8-3.4 1.7-0.9 4.2-1.8 7.9-1.9-0.3-0.8-0.7-1.9-1.5-2.9-0.5-0.6-1.1-1.1-1.7-1.6-1.1-0.8-2.3-1-3.7-0.6-1.5 0.5-3.2 0.8-4.7 1.3-3.6 1-7.2 1.2-10.9 0.3-2.7-0.6-4.9 0.2-7.1 1.3z"/>
                <path fill="#f47216" d="m72.2 8.7c7.5 11.2 13.4 23 16.2 36.1 1.3 6 2 12.1 0.7 18.3-1.2 5.1-3.7 9.5-7.8 12.7-6 4.6-14.4 4.1-20.2-1.2-5.3-4.8-7.7-10.9-7.8-17.9-0.1-6.9 1.7-13.5 4.1-19.9 3.6-9.8 8.8-18.9 14.6-27.6-0.1-0.2 0-0.3 0.2-0.5zm-39 48.4c-1.7-5.5-2.5-11.2-2.5-17 0-4.2 0.9-8.5 1.3-12.7 0.1-0.5-0.1-1.2-0.4-1.5-2.5-2.8-4.8-5.7-7.5-8.2-5.1-4.6-11-7.4-17.7-7.6 1.3 2.9 2.9 5.7 3.9 8.8 2.6 7.4 3.1 15.1 3.1 22.9 0 4 0.7 7.8 2.2 11.4 2.5 6.2 6.1 11.7 11.7 15.6 4 2.8 8.5 3.6 13.6 2.1-3.8-4.1-6.1-8.8-7.7-13.8zm68.9 17.3c1.8 0.1 3.7 0.5 5.5 0.4 3.9-0.2 7.2-2.1 9.9-4.9 7.4-7.5 11.3-16.6 11-27.2-0.1-5.6-0.6-11.2-0.7-16.7-0.1-4.8 1.4-9.3 4-13.3 0.7-1.1 1.6-2.2 2.5-3.4-3.2 0.1-6.1 0.8-8.9 2.1-7.5 3.6-12.6 9.6-16.2 17-0.2 0.3-0.2 0.8-0.1 1.1 1.2 4.9 2.2 9.9 2.6 14.9 0.4 6 0.1 11.8-1.9 17.5-1.6 4.6-4.1 8.6-7.8 11.9 0.1 0.3 0.1 0.4 0.1 0.6zm-13.4 2.6c9.4-1.8 17.1-9.7 18.8-19.4 1.1-6.5 0.5-13-0.7-19.4-0.9-4.6-2.2-9.1-3.3-13.7-0.9-3.8-1.4-7.6-0.4-11.4 0.4-1.5 0.9-2.9 1.5-4.7-1.6 0.4-3.1 0.7-4.5 1.3-6.5 2.5-10.9 7.3-14.4 13.2-0.2 0.3-0.2 0.9 0 1.3 4.4 8.3 7.5 17.1 8.2 26.6 0.3 3.4 0.4 7-0.1 10.4-0.7 5-3.1 9.4-5.6 13.6-0.5 0.8-0.9 1.5-1.6 2.6 1-0.3 1.5-0.3 2.1-0.4zm-50.7-63.3c1.2 4 0.9 8.2-0.1 12.2-1.6 5.7-2.4 11.5-2.3 17.5 0.1 6.4 1.4 12.5 4.3 18.2 2.8 5.4 6.6 9.8 12.1 12.5 1.2 0.6 2.5 1 3.9 1.6-1.1-1.8-2.1-3.2-2.9-4.8-4-8.1-4.8-16.6-3.2-25.5 1.1-5.9 3.2-11.5 5.5-17.1 0.2-0.5 0.3-1.4 0-1.9-2.8-4.9-6.1-9.4-10.3-13.2-2.8-2.6-5.9-4.6-9.5-5.5 0.9 2.1 1.9 4 2.5 6z"/>
              </svg>
            </div>
            <div style={{ textAlign: 'center', flex: 1, padding: '0 4px' }}>
              <div className="poster-header-text" style={{ fontSize: 11.5, fontWeight: 900, letterSpacing: '0.03em', color: '#f76201', textTransform: 'uppercase', lineHeight: 1.2 }}>
                BHARATIYA JANATA PARTY
              </div>
              <div style={{ fontSize: 8.5, fontWeight: 800, color: '#475569', marginTop: 1 }}>
                TAMIL NADU LOCAL BODY ELECTIONS 2026-27
              </div>
            </div>
            <div style={{ width: 14 }} />
          </div>

          {/* Candidate Avatar & Badge Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, marginTop: 2, zIndex: 1 }}>
            <div style={{ position: 'relative' }}>
              <div
                className="poster-avatar-img"
                style={{
                  width: 84, height: 84, borderRadius: '50%',
                  backgroundImage: `url("${candidateImg}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'top center',
                  backgroundRepeat: 'no-repeat',
                  border: '4px solid #FFFFFF', boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                  backgroundColor: '#FFFFFF'
                }}
              />
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                background: '#00A650', color: '#FFF', width: 22, height: 22,
                borderRadius: '50%', border: '2px solid #FFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900
              }}>
                ✓
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#FFFFFF', textTransform: 'capitalize', textShadow: '0 2px 4px rgba(0,0,0,0.25)' }}>
                {candName}
              </div>
            </div>
          </div>

          {/* Candidate Details Box (Pure White Panel inside Saffron Card) */}
          <div className="poster-details-box" style={{
            background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.6)',
            borderRadius: 14, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4.5,
            fontSize: 11, zIndex: 1, boxShadow: '0 6px 18px rgba(0,0,0,0.15)', color: '#0F172A'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 3 }}>
              <span style={{ color: '#64748B', fontWeight: 500 }}>Application ID:</span>
              <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#FF6600', fontSize: 12 }}>{result.application_id}</span>
            </div>
            {epicNo && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 3 }}>
                <span style={{ color: '#64748B', fontWeight: 500 }}>EPIC / Voter ID:</span>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>{epicNo}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 3 }}>
              <span style={{ color: '#64748B', fontWeight: 500 }}>Contest Preference:</span>
              <span style={{ fontWeight: 700, color: '#E65C00' }}>{firstPos}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B', fontWeight: 500 }}>Local Body Ward:</span>
              <span style={{ fontWeight: 700, color: '#0F172A', fontSize: 9, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{lbSummary}</span>
            </div>
          </div>

          {/* Candidate Declaration Banner (Large Font, Premium Typography & Compact Spacing) */}
          <div style={{
            margin: '2px 0', background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.28)',
            borderRadius: 10, padding: '7px 12px', textAlign: 'center', color: '#FFFFFF',
            fontSize: 11, fontWeight: 800, fontFamily: "'Outfit', 'Inter', system-ui, -apple-system, sans-serif",
            lineHeight: 1.38, letterSpacing: '0.015em', textShadow: '0 1px 3px rgba(0,0,0,0.4)', zIndex: 1
          }}>
            {t('I have applied to the Bharatiya Janata Party to contest the local body elections and have received the necessary certificate.')}
          </div>

          {/* QR Code & Verification Stamp Footer (Pure White Panel inside Saffron Card) */}
          <div style={{
            background: '#FFFFFF', borderRadius: 12, padding: '8px 10px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)', zIndex: 1, color: '#0F172A'
          }}>
            <div>
              <div style={{ fontSize: 8, color: '#64748B', fontWeight: 500 }}>Submitted Timestamp</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#0F172A', marginTop: 1 }}>
                {fmtDateTime(result.submitted_at)}
              </div>
              <div style={{ fontSize: 8, color: '#FF6600', marginTop: 1, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 3 }}>
                <i className="bi bi-shield-check" /> Official Party Verification 2026-27
              </div>
            </div>
            {qrUrl && (
              <a href={verifyLinkUrl} target="_blank" rel="noopener noreferrer" title="Click to view candidate verification page">
                <img
                  src={qrUrl}
                  alt="QR Verification"
                  className="poster-qr-img"
                  style={{ width: 44, height: 44, borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFF', display: 'block', cursor: 'pointer' }}
                />
              </a>
            )}
          </div>
        </div>

        {/* Button to Open 9:16 Digital Card Template Modal */}
        <button
          type="button"
          style={{
            ...primaryBtn(true),
            background: 'linear-gradient(135deg, #f76201 0%, #d85400 100%)',
            boxShadow: '0 4px 14px rgba(247, 98, 1, 0.35)',
            padding: '12px 16px',
            width: '100%'
          }}
          onClick={() => setShowPosterModal(true)}
        >
          <i className="bi bi-aspect-ratio-fill" style={{ fontSize: 16 }} />
          {t('View / Download 9:16 Digital Application Poster Card')} 📱
        </button>
      </div>

      {/* BJP Organiser Get In Touch Box */}
      <div style={cardBox}>
        <div style={cardTitle}>
          <i className="bi bi-person-lines-fill text-saffron" />
          {t('BJP Organiser Get In Touch')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-ash)', lineHeight: 1.4 }}>
          {t('You can reach out to your local BJP Organiser for updates or send a one-time message directly.')}
        </div>

        <div style={{ background: 'var(--color-abyss)', border: '1px solid var(--color-graphite)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#FF6600', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="bi bi-telephone-fill" /> {t('BJP Organiser Helpline Numbers')}:
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-chalk)' }}>
            +91 98765 43210 &nbsp;|&nbsp; +91 91234 56789
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-ash)' }}>
            <i className="bi bi-geo-alt-fill text-saffron me-1" />
            {t('BJP Party Headquarters & Organiser Office')}
          </div>
        </div>

        {sentMsg ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: '#ECFDF5', border: '1.5px solid #10B981', borderRadius: 10, padding: 10, color: '#059669', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="bi bi-check-circle-fill" style={{ fontSize: 18 }} />
              <div>{t('✓ Message sent to Organiser (One-time submission completed)')}</div>
            </div>

            <div style={{ background: 'rgba(255,102,0,0.06)', border: '1.5px solid #FF6600', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#FF6600', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="bi bi-chat-square-quote-fill" /> {t('Organiser Reach Out Message (One-Time Candidate Query)')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-chalk)', fontWeight: 600, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                "{sentMsg.text}"
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-ash)', marginTop: 2 }}>
                <i className="bi bi-clock-history me-1" />
                {t('Sent on')}: {fmtDateTime(sentMsg.sent_at)}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={fieldLabel}>
              <i className="bi bi-chat-left-dots-fill text-saffron me-1" />
              {t('Send a One-Time Request / Message to Organiser')}
            </span>
            <textarea
              style={{ ...controlStyle, resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
              rows={3}
              value={orgMsg}
              disabled={sending}
              placeholder={t('Type your query or one-time message to local BJP Organiser here...')}
              onChange={(e) => { setOrgMsg(e.target.value); if (error) setError('') }}
            />
            {error && <div style={{ fontSize: 12, color: '#e74c3c' }}><i className="bi bi-exclamation-circle" /> {error}</div>}
            <button
              style={primaryBtn(Boolean(orgMsg.trim()) && !sending)}
              disabled={!orgMsg.trim() || sending}
              onClick={handleSendOrganiserMsg}
            >
              {sending ? t('Sending message...') : t('Send Request to Organiser')} <i className="bi bi-send-fill" />
            </button>
          </div>
        )}
      </div>




      {/* 9:16 Ratio Poster Template Modal */}
      {showPosterModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(6px)',
          zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 16, overflowY: 'auto'
        }}>
          <div style={{ maxWidth: 380, width: '100%', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            
            {/* Modal Top Actions with Language Toggle */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#FFF', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#f76201', display: 'flex', alignItems: 'center', gap: 4 }}>
                <i className="bi bi-phone-fill me-1" /> 9:16 Card
              </span>

              {/* Language Switcher (EN / தமிழ்) */}
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 3, border: '1px solid rgba(255,255,255,0.25)' }}>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  style={{
                    background: lang === 'en' ? '#f76201' : 'transparent',
                    color: '#FFF', border: 'none', borderRadius: 14, padding: '3px 10px',
                    fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLang('ta')}
                  style={{
                    background: lang === 'ta' ? '#f76201' : 'transparent',
                    color: '#FFF', border: 'none', borderRadius: 14, padding: '3px 10px',
                    fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  தமிழ்
                </button>
              </div>

              <button
                onClick={() => setShowPosterModal(false)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#FFF', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* 9:16 Aspect Ratio Poster Card Container (BJP Saffron #f76201 Theme) */}
            <div
              ref={posterRef}
              className="bjp-poster-916-card"
              style={{
                width: '100%',
                maxWidth: 350,
                aspectRatio: '9 / 16',
                background: 'linear-gradient(165deg, #f76201 0%, #d85400 100%)',
                border: '3px solid #f76201',
                borderRadius: 20,
                boxShadow: '0 12px 36px rgba(247, 98, 1, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '16px 14px',
                boxSizing: 'border-box',
                position: 'relative',
                overflow: 'hidden',
                color: '#FFFFFF'
              }}
            >
              {/* Top Tricolor Accent Line */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 5,
                background: 'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 50%, #00A650 50%, #00A650 100%)',
                zIndex: 10
              }} />

              {/* Watermark Lotus Background */}
              <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.08, pointerEvents: 'none' }}>
                <img src="/bjp_logo.png" alt="" style={{ width: 260 }} onError={(e) => { e.target.src = '/bjp_logo.svg' }} />
              </div>

              {/* Poster Top Banner Header (Pure White Panel) */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: 14, padding: '9px 12px', textAlign: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)', zIndex: 1
              }}>
                <div style={{ width: 38, height: 38, background: '#FFF7ED', borderRadius: '50%', border: '1px solid #FFE4D6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 3, flexShrink: 0 }}>
                  <svg viewBox="0 0 141 151" width="30" height="30">
                    <path fill="#000000" d="m19.4 88.3c-1.1-1.8-0.9-3.4-0.3-5.1 1.4-3.7 4.2-6.2 7.3-8.3 0.4-0.2 0.7-0.5 0.9-0.6-2.1-1.5-4.5-2.8-6.5-4.6-5.1-4.6-7.9-10.6-9.8-17-1.8-5.9-2.4-12.1-2.4-18.2 0-7.7-1.7-15.1-5.3-21.9-1.1-2-2.4-3.9-3.7-5.9 1.4-1.3 3.2-1.5 5-1.5 5.7-0.1 10.9 1.6 15.8 4.4 5.1 3 9.2 7 12.6 11.7 0.2 0.3 0.5 0.6 0.8 1 2.3-7.3-1.5-12.6-5.3-18 2-1.2 4.1-0.9 6.1-0.6 7.6 1.1 13.7 5 18.7 10.6 1.9 2.1 3.4 4.5 5 6.8 0.3 0.3 0.5 0.7 0.5 0.8 4.3-7.2 8.5-14.4 13-22 4.8 6.1 7.8 12.6 10.8 18.9 2.4-2.7 4.8-5.5 7.4-8 3.8-3.6 8.2-6.3 13.2-7.7 2.7-0.7 4.2-0.7 7 0.3-3.4 6.1-4.8 12.5-3.1 19.3 1.4-1.9 2.7-4 4.3-5.8 5.3-6.2 11.7-10.4 19.9-11.7 2.4-0.4 4.9-0.6 7.2 0.1 0.7 0.2 1.4 0.6 2.3 1-0.4 0.5-0.7 0.8-1 1.1-4.4 5-7.3 10.6-7.5 17.4-0.1 3.8 0.2 7.6 0.5 11.4 0.6 8-0.1 15.7-3.5 23.1-2.4 5.3-5.8 9.9-10.1 13.9-0.1 0.1-0.3 0.3-0.4 0.4-0.1 0.1-0.1 0.1-0.1 0.2 4.2 3.8 8 7.7 6 14.3-0.8-0.5-1.4-0.9-2-1.3-1.6-1.1-3.3-1.3-5.1-0.7-2.9 0.8-5.3 2.5-7.5 4.4-3 2.7-6.4 4.5-10.4 5.2-3.8 0.7-7.6 0.5-11.3-1-0.4-0.2-0.9-0.2-1.3-0.1-6.3 1.4-10.8 7-10.7 13 0.1 6.8-0.3 13.6-2.1 20.2-0.7 2.4-1.7 4.6-2.6 6.9q2.7-0.3 5.7-0.6c0.6-0.1 1.2-0.2 1.8 0 1 0.2 1.3 1 1.1 2-0.2 1.1-1.1 2-1.9 2-2.7-0.1-5.4-0.2-8.1-0.1-1.7 0-1.9-1.4-2.6-2.3-0.7-0.8 0-1.3 0.4-1.9 2-2.9 2.9-6.2 3.3-9.7 0.6-4.9 0.9-9.8 1.2-14.7 0.1-1.5-0.4-2-2.1-2.3 0 0.5-0.1 1-0.1 1.5 0 5.4 0 10.7-1.1 16-0.9 4.1-2.2 7.9-5.3 10.9-3.2 3.1-7.2 4.1-11.5 4-2.1-0.1-4.3-0.3-6.4-0.8-2.1-0.5-2.4-2.2-0.8-3.7 1.6-1.6 3.6-1.9 5.8-1.8 2.9 0.2 5.9 0.5 8.8 0.8 1 0.1 1.5-0.3 2-1.1 3.2-4.7 4.7-10 5.2-15.6 0.3-4.4 0.1-8.8-1.6-13-1.2-2.9-3-5.2-5.8-6.8-1.9-1.1-3.7-2.3-5.6-3.4-0.3-0.2-0.8-0.3-1-0.2-4 1.9-8 1.4-12 0.3-2.8-0.8-5.2-2.2-7.5-3.9-2.5-1.8-5.2-3.2-8.2-3.7-2.1-0.1 4.0 0.4-6 1.7zm37.5 47.4c-1.1 0.1-2.2 0.3-3.2 0.4-1.5 0.1-2.7-0.5-4.2 0-0.2 0.1-0.9 0.3-0.9 0.6 0 0.2 0.2 0.4 0.8 0.6 1.3 0.4 2.2 0.1 5.4 0 1.1 0 1.8-0.5 2.1-1.6z"/>
                    <path fill="#00a650" d="m24.1 82.9c0.1 0.1 0.2 0.2 0.4 0.3 0.6-0.1 1.2-0.2 1.8-0.2 3.4-0.1 5.5 1.7 9.2 3.6 1.5 0.8 3.9 2 7.1 2.8 1.8 0.5 7.2 1.9 8.5 0 0.5-0.7-0.1-1.1 0.3-3.5 0.3-2 0.9-3.5 1-3.8 0.4-0.8 1-2 2.1-3.2-0.2-0.1-0.5-0.2-0.7-0.3-2.7-1.1-5.4-2.2-8.2-3.3-0.6-0.2-1.3-0.3-1.9-0.1-3.4 1.1-6.8 1.6-10.4 0.6-0.5-0.1-1.2-0.1-1.6 0.2-1.7 1.1-3.4 2.2-4.9 3.5-1.1 0.9-1.8 2.3-2.7 3.4z"/>
                    <path fill="#00a650" d="m70 99.2c1 0.5 2.4 1 3.8 0.5 1.7-0.7 1.5-2.3 3.5-4.5 0.7-0.7 2-2.1 5.4-3.5 1.2-0.5 2.3-1.1 3.3-2 2.9-2.6 3-7.2 0.3-9.7-0.6-0.6-1.2-0.7-2-0.4-7.9 2.9-15.9 2.7-23.8 0.1-1.3-0.4-2-0.1-2.8 0.9-2 2.6-2 6.8 0.1 9.2 1.1 1.3 2.7 2.1 4 3.2 1.9 1.7 3.2 1.4 4.9 2.7 1.6 1.2 2.7 2.6 3.3 3.5z"/>
                    <path fill="#00a650" d="m90.6 80.3c0.6 0.9 1 1.8 1.3 2.7 0.1 0.5 0.5 2 0.2 4-0.3 2-1 2.2-0.8 2.9 0.5 1.8 5.4 2.6 9.5 1.5 2.2-0.6 3.8-1.7 6.7-3.6 2.8-1.9 3-2.5 4.8-3.4 1.7-0.9 4.2-1.8 7.9-1.9-0.3-0.8-0.7-1.9-1.5-2.9-0.5-0.6-1.1-1.1-1.7-1.6-1.1-0.8-2.3-1-3.7-0.6-1.5 0.5-3.2 0.8-4.7 1.3-3.6 1-7.2 1.2-10.9 0.3-2.7-0.6-4.9 0.2-7.1 1.3z"/>
                    <path fill="#f47216" d="m72.2 8.7c7.5 11.2 13.4 23 16.2 36.1 1.3 6 2 12.1 0.7 18.3-1.2 5.1-3.7 9.5-7.8 12.7-6 4.6-14.4 4.1-20.2-1.2-5.3-4.8-7.7-10.9-7.8-17.9-0.1-6.9 1.7-13.5 4.1-19.9 3.6-9.8 8.8-18.9 14.6-27.6-0.1-0.2 0-0.3 0.2-0.5zm-39 48.4c-1.7-5.5-2.5-11.2-2.5-17 0-4.2 0.9-8.5 1.3-12.7 0.1-0.5-0.1-1.2-0.4-1.5-2.5-2.8-4.8-5.7-7.5-8.2-5.1-4.6-11-7.4-17.7-7.6 1.3 2.9 2.9 5.7 3.9 8.8 2.6 7.4 3.1 15.1 3.1 22.9 0 4 0.7 7.8 2.2 11.4 2.5 6.2 6.1 11.7 11.7 15.6 4 2.8 8.5 3.6 13.6 2.1-3.8-4.1-6.1-8.8-7.7-13.8zm68.9 17.3c1.8 0.1 3.7 0.5 5.5 0.4 3.9-0.2 7.2-2.1 9.9-4.9 7.4-7.5 11.3-16.6 11-27.2-0.1-5.6-0.6-11.2-0.7-16.7-0.1-4.8 1.4-9.3 4-13.3 0.7-1.1 1.6-2.2 2.5-3.4-3.2 0.1-6.1 0.8-8.9 2.1-7.5 3.6-12.6 9.6-16.2 17-0.2 0.3-0.2 0.8-0.1 1.1 1.2 4.9 2.2 9.9 2.6 14.9 0.4 6 0.1 11.8-1.9 17.5-1.6 4.6-4.1 8.6-7.8 11.9 0.1 0.3 0.1 0.4 0.1 0.6zm-13.4 2.6c9.4-1.8 17.1-9.7 18.8-19.4 1.1-6.5 0.5-13-0.7-19.4-0.9-4.6-2.2-9.1-3.3-13.7-0.9-3.8-1.4-7.6-0.4-11.4 0.4-1.5 0.9-2.9 1.5-4.7-1.6 0.4-3.1 0.7-4.5 1.3-6.5 2.5-10.9 7.3-14.4 13.2-0.2 0.3-0.2 0.9 0 1.3 4.4 8.3 7.5 17.1 8.2 26.6 0.3 3.4 0.4 7-0.1 10.4-0.7 5-3.1 9.4-5.6 13.6-0.5 0.8-0.9 1.5-1.6 2.6 1-0.3 1.5-0.3 2.1-0.4zm-50.7-63.3c1.2 4 0.9 8.2-0.1 12.2-1.6 5.7-2.4 11.5-2.3 17.5 0.1 6.4 1.4 12.5 4.3 18.2 2.8 5.4 6.6 9.8 12.1 12.5 1.2 0.6 2.5 1 3.9 1.6-1.1-1.8-2.1-3.2-2.9-4.8-4-8.1-4.8-16.6-3.2-25.5 1.1-5.9 3.2-11.5 5.5-17.1 0.2-0.5 0.3-1.4 0-1.9-2.8-4.9-6.1-9.4-10.3-13.2-2.8-2.6-5.9-4.6-9.5-5.5 0.9 2.1 1.9 4 2.5 6z"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center', flex: 1, padding: '0 6px' }}>
                  <div className="poster-header-text" style={{ fontSize: 12.5, fontWeight: 900, letterSpacing: '0.03em', color: '#f76201', textTransform: 'uppercase' }}>
                    BHARATIYA JANATA PARTY
                  </div>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: '#475569', marginTop: 2 }}>
                    TAMIL NADU LOCAL BODY ELECTIONS 2026-27
                  </div>
                </div>
                <div style={{ width: 20 }} />
              </div>

              {/* Candidate Avatar & Badge Section */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 6, zIndex: 1 }}>
                <div style={{ position: 'relative' }}>
                  <div
                    className="poster-avatar-img"
                    style={{
                      width: 94, height: 94, borderRadius: '50%',
                      backgroundImage: `url("${candidateImg}")`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'top center',
                      backgroundRepeat: 'no-repeat',
                      border: '4px solid #FFFFFF', boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                      backgroundColor: '#FFFFFF'
                    }}
                  />
                  <div style={{
                    position: 'absolute', bottom: 0, right: 0,
                    background: '#00A650', color: '#FFF', width: 26, height: 26,
                    borderRadius: '50%', border: '2.5px solid #FFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900
                  }}>
                    ✓
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', textTransform: 'capitalize', textShadow: '0 2px 4px rgba(0,0,0,0.25)' }}>
                    {candName}
                  </div>
                </div>
              </div>

              {/* Candidate Details Box (Pure White Panel inside Saffron Card) */}
              <div className="poster-details-box" style={{
                background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.6)',
                borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 7,
                fontSize: 12, zIndex: 1, boxShadow: '0 6px 18px rgba(0,0,0,0.15)', color: '#0F172A'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 5 }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Application ID:</span>
                  <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#FF6600', fontSize: 13 }}>{result.application_id}</span>
                </div>
                {epicNo && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 5 }}>
                    <span style={{ color: '#64748B', fontWeight: 500 }}>EPIC / Voter ID:</span>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{epicNo}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 5 }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Contest Preference:</span>
                  <span style={{ fontWeight: 700, color: '#E65C00' }}>{firstPos}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Local Body Ward:</span>
                  <span style={{ fontWeight: 700, color: '#0F172A', fontSize: 9, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{lbSummary}</span>
                </div>
              </div>

              {/* Candidate Declaration Banner (Large Font, Premium Typography & Compact Spacing) */}
              <div style={{
                margin: '2px 0', background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.28)',
                borderRadius: 10, padding: '7px 12px', textAlign: 'center', color: '#FFFFFF',
                fontSize: 11, fontWeight: 800, fontFamily: "'Outfit', 'Inter', system-ui, -apple-system, sans-serif",
                lineHeight: 1.38, letterSpacing: '0.015em', textShadow: '0 1px 3px rgba(0,0,0,0.4)', zIndex: 1
              }}>
                {t('I have applied to the Bharatiya Janata Party to contest the local body elections and have received the necessary certificate.')}
              </div>

              {/* QR Code & Verification Stamp Footer (Pure White Panel inside Saffron Card) */}
              <div style={{
                background: '#FFFFFF', borderRadius: 12, padding: '10px 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)', zIndex: 1, color: '#0F172A'
              }}>
                <div>
                  <div style={{ fontSize: 8, color: '#64748B', fontWeight: 500 }}>Submitted Timestamp</div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#0F172A', marginTop: 1 }}>
                    {fmtDateTime(result.submitted_at)}
                  </div>
                  <div style={{ fontSize: 8, color: '#FF6600', marginTop: 1, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <i className="bi bi-shield-check" /> Official Party Verification 2026-27
                  </div>
                </div>
                {qrUrl && (
                  <a href={verifyLinkUrl} target="_blank" rel="noopener noreferrer" title="Click to view candidate verification page">
                    <img src={qrUrl} alt="QR Verification" className="poster-qr-img" style={{ width: 48, height: 48, borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFF', display: 'block', cursor: 'pointer' }} />
                  </a>
                )}
              </div>
            </div>





            {/* Download Button */}
            <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 350 }}>
              <button
                onClick={handleDownloadPoster}
                disabled={downloading}
                style={{ ...primaryBtn(true), background: '#10B981' }}
              >
                <i className="bi bi-download" /> {downloading ? t('Generating PNG Card...') : t('Download 9:16 Card Image')}
              </button>
              <button
                onClick={() => setShowPosterModal(false)}
                style={{ ...secondaryBtn(true), flex: '0 0 80px' }}
              >
                {t('Close')}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Interactive QR Scan Verification Preview Modal */}
      {showQrScanModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
          zIndex: 999999, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 16
        }}>
          <div style={{
            width: '100%', maxWidth: 360, background: '#FFFFFF', borderRadius: 20,
            padding: 20, color: '#0F172A', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            display: 'flex', flexDirection: 'column', gap: 14, position: 'relative',
            border: '2px solid #f76201'
          }}>
            <button
              onClick={() => setShowQrScanModal(false)}
              style={{
                position: 'absolute', top: 12, right: 12, background: '#F1F5F9', border: 'none',
                width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontWeight: 800, color: '#64748B'
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#ECFDF5', border: '2px solid #10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="bi bi-qr-code-scan" style={{ fontSize: 24, color: '#059669' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>
                  {t('QR Code Verification Scan')}
                </div>
                <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, wordBreak: 'break-all', marginTop: 1 }}>
                  https://membership.bjp.org/verify
                </div>
              </div>
            </div>

            <div style={{ background: '#ECFDF5', border: '1.5px solid #10B981', borderRadius: 14, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 900, color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <i className="bi bi-patch-check-fill" style={{ fontSize: 20 }} /> {t('VERIFIED REGISTERED CANDIDATE')}
              </div>
              <div style={{ fontSize: 11, color: '#047857', marginTop: 3, fontWeight: 600 }}>
                {t('Official Party Digital Verification Record 2026-27')}
              </div>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: 5 }}>
                <span style={{ color: '#64748B' }}>{t('Candidate Name')}:</span>
                <span style={{ fontWeight: 800, color: '#0F172A' }}>{candName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: 5 }}>
                <span style={{ color: '#64748B' }}>{t('Application ID')}:</span>
                <span style={{ fontWeight: 800, color: '#f76201', fontFamily: 'monospace', fontSize: 13 }}>{result.application_id}</span>
              </div>
              {epicNo && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: 5 }}>
                  <span style={{ color: '#64748B' }}>{t('Voter EPIC No')}:</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{epicNo}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: 5 }}>
                <span style={{ color: '#64748B' }}>{t('Contest Position')}:</span>
                <span style={{ fontWeight: 700, color: '#f76201' }}>{firstPos}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ color: '#64748B' }}>{t('Local Body Ward')}:</span>
                <span style={{ fontWeight: 700, color: '#0F172A', fontSize: 11.5 }}>{lbSummary}</span>
              </div>
            </div>

            <button
              onClick={() => setShowQrScanModal(false)}
              style={{ ...primaryBtn(true), background: 'linear-gradient(135deg, #f76201 0%, #d85400 100%)', width: '100%' }}
            >
              {t('Close QR Verification')}
            </button>
          </div>

        </div>
      )}
    </div>
  )
}





// ── Main page ──────────────────────────────────────────────
export default function ChatbotPage() {
  const { t, lang, setLang } = useLang()
  const [chatState, setChatState] = useState(S.WELCOME)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sendHint, setSendHint] = useState('')
  const [otpResendIn, setOtpResendIn] = useState(0)
  const [appData, setAppData] = useState(emptyAppData())
  const [showSocialMenu, setShowSocialMenu] = useState(false)

  const sendHintTimer = useRef(null)
  const otpTimerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const initializedRef = useRef(false)
  const mobileRef = useRef('')
  const appDataRef = useRef(appData)
  // Background media uploads keyed by kind ('photo' | 'video' | 'doc').
  // Each entry: { file, promise } where promise resolves to the stored URL.
  // Uploads start the moment a file is picked, so submit is near-instant.
  const uploadsRef = useRef({})

  useEffect(() => { appDataRef.current = appData }, [appData])

  // Kick off a media upload in the background and remember its promise. Photos
  // are compressed first. Rejections are caught here and re-surfaced at submit.
  const startBackgroundUpload = useCallback((kind, file) => {
    if (!file) { uploadsRef.current[kind] = null; return }
    const promise = (async () => {
      const toSend = kind === 'photo' ? await compressImage(file) : file
      const fd = new FormData()
      fd.append('file', toSend)
      fd.append('mobile', mobileRef.current || 'general')
      const res = await chat.uploadMedia(fd)
      return res?.url || ''
    })()
    promise.catch(() => {}) // avoid unhandled rejection; awaited again at submit
    uploadsRef.current[kind] = { file, promise }
  }, [])
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

    clearSession()
    stopOtpCountdown()
    setAppData(emptyAppData())
    mobileRef.current = ''
    setMessages([])
    addMsg('bot', 'welcome_banner', {})
    setChatState(S.WELCOME)
  }, [addMsg])

  // Persist session active state for active chatbot users (refreshed sliding 30-min window)
  useEffect(() => {
    if (chatState !== S.WELCOME && chatState !== S.SUBMITTED) {
      // Persist only lightweight, serialisable fields. File objects can't be
      // restored anyway, and the base64 `photoUrl` preview can be several MB —
      // large enough to blow the localStorage quota, which would make the save
      // fail silently and trigger false "inactivity" logouts on tab switches.
      const { photoFile, videoFile, docFile, photoUrl, ...persistable } = appData
      saveSession({
        chatState,
        appData: persistable,
        mobile: mobileRef.current,
      })
    } else {
      clearSession()
    }
  }, [chatState, appData])


  // ── Auto-logout after 30 minutes of inactivity (sliding) ──
  const inactivityRef = useRef(null)
  const lastActivityRef = useRef(0)

  const doAutoLogout = useCallback(() => {
    if (inactivityRef.current) { clearTimeout(inactivityRef.current); inactivityRef.current = null }
    if (otpTimerRef.current) { clearInterval(otpTimerRef.current); otpTimerRef.current = null }
    setOtpResendIn(0)
    clearSession()
    mobileRef.current = ''
    setAppData(emptyAppData())
    setInputValue('')
    setMessages([])
    setChatState(S.WELCOME)
    addMsg('bot', 'text', { text: t('🔒 You were logged out after 30 minutes of inactivity. Tap Start to begin again.') })
    addMsg('bot', 'welcome_banner', {})
  }, [addMsg, t])

  useEffect(() => {
    if (!initializedRef.current) return
    if (chatState === S.WELCOME) return // nothing to log out from on the start screen

    const arm = () => {
      if (inactivityRef.current) clearTimeout(inactivityRef.current)
      inactivityRef.current = setTimeout(() => doAutoLogout(), INACTIVITY_MS)
    }
    const onActivity = () => {
      const now = Date.now()
      if (now - lastActivityRef.current < 15000) return // throttle to once / 15s
      lastActivityRef.current = now
      touchSession()
      arm()
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      // Decide purely on real elapsed inactivity time — never on whether
      // localStorage happens to hold a session. This avoids false logouts on
      // tab switches / refreshes caused by any storage hiccup.
      const elapsed = Date.now() - lastActivityRef.current
      if (elapsed >= INACTIVITY_MS && chatState !== S.WELCOME) { doAutoLogout(); return }
      touchSession()
      if (inactivityRef.current) clearTimeout(inactivityRef.current)
      inactivityRef.current = setTimeout(() => doAutoLogout(), Math.max(1000, INACTIVITY_MS - elapsed))
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', onVisible)

    lastActivityRef.current = Date.now()
    touchSession()
    arm()

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisible)
      if (inactivityRef.current) { clearTimeout(inactivityRef.current); inactivityRef.current = null }
    }
  }, [chatState, doAutoLogout])

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
    clearSession()
    mobileRef.current = ''
    setAppData(emptyAppData())
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
        addMsg('bot', 'membership_card', {})
        setChatState(S.AWAIT_MEMBERSHIP)
      } else {
        await botSay(`❌ ${res?.message || t('Invalid OTP. Please try again.')}`, 250)
      }
    } catch (err) {
      setIsTyping(false)
      await botSay(`❌ ${err?.message || t('Invalid OTP. Please try again.')}`, 250)
    }
  }

  const handleMembershipSubmit = async (customVal) => {
    const rawVal = customVal !== undefined ? customVal : inputValue
    const membershipId = String(rawVal || '').trim()
    if (!membershipId) {
      flashSendHint(t('BJP Membership ID is required.'))
      return
    }
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
    const defDist = appData.voter?.district || 'Chennai'
    if (!appData.contestDistrict) {
      patchData({ contestDistrict: defDist })
    }
    await botSay(t('Please upload your Candidate Passport Size Photo (Max 15 MB).'), 350)
    addMsg('bot', 'photo_upload', {})
    setChatState(S.PHOTO_UPLOAD)
  }

  const handlePhotoSubmit = async ({ photoFile, photoUrl }) => {
    patchData({ photoFile, photoUrl })
    startBackgroundUpload('photo', photoFile) // upload now, in the background
    addMsg('user', 'text', { text: photoUrl ? t('Passport photo ready ✓') : t('Skipped') })
    await botSay(t('Please confirm or select the District you are contesting in.'), 350)
    addMsg('bot', 'district', {})
    setChatState(S.DISTRICT)
  }

  const handleDistrictSubmit = async ({ district }) => {
    patchData({ contestDistrict: district })
    const alreadyHasLocalBody = messages.some((m) => m.type === 'local_body')
    if (chatState === S.LOCAL_BODY || alreadyHasLocalBody) {
      // Already on Local Body step or card already present — update district in-place without adding any extra cards
      return
    }
    addMsg('user', 'text', { text: t('Contesting District: {district}', { district }) })
    await botSay(t('Great! Now, choose your Local Body & Position details in {district}.', { district }), 350)
    addMsg('bot', 'local_body', {})
    setChatState(S.LOCAL_BODY)
  }


  const handleRetryVoter = async () => {
    addMsg('user', 'text', { text: t('↩ Re-enter ID') })
    patchData({ voter: null, epic: '' })
    await botSay(t('Please enter your EPIC Number (Voter ID) again.'), 250)
    setChatState(S.AWAIT_EPIC)
  }

  const handleLocalBodySubmit = async ({ contestDistrict, bodyType, localBody, positionPrefs }) => {
    const patch = { bodyType, localBody, positionPrefs }
    if (contestDistrict) patch.contestDistrict = contestDistrict
    patchData(patch)
    const summary = localBodySummary(bodyType, localBody)
    const pos = positionPrefs?.[0] || ''
    const distName = contestDistrict || appData.contestDistrict || ''
    addMsg('user', 'text', { text: `${distName ? distName + ' · ' : ''}${bodyType === 'rural' ? t('Rural') : t('Urban')} · ${pos}${summary ? ' · ' + summary : ''}` })
    await botSay(t('Please add your social media profiles (Optional).'), 350)
    addMsg('bot', 'social', {})
    setChatState(S.SOCIAL)
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
    await botSay(t('Share your 1-minute Candidate Pitch Video (Optional).'), 350)
    addMsg('bot', 'video_upload', {})
    setChatState(S.VIDEO_UPLOAD)
  }

  const handleVideoSubmit = async ({ videoUrl, videoFile, videoFileName }) => {
    patchData({ videoUrl, videoFile, videoFileName })
    startBackgroundUpload('video', videoFile) // upload now, in the background
    const hasVideo = videoUrl || videoFile
    addMsg('user', 'text', { text: hasVideo ? t('Pitch video ready ✓') : t('Skipped') })
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
    await botSay(t('Optional: Key Ward Development Priorities & Grievance Redressal Plan (Max 150 words each).'), 400)
    addMsg('bot', 'short_texts', {})
    setChatState(S.SHORT_TEXTS)
  }

  const handleShortTextsSubmit = async ({ devPriorities, grievancePlan }) => {
    patchData({ devPriorities, grievancePlan })
    const hasData = devPriorities || grievancePlan
    addMsg('user', 'text', { text: hasData ? t('Additional ward details provided ✓') : t('Skipped') })
    await botSay(t('Optional: Upload supporting Candidate Profile or Vision Document (PDF or DOCX).'), 400)
    addMsg('bot', 'doc_upload', {})
    setChatState(S.DOC_UPLOAD)
  }

  const handleDocUploadSubmit = async ({ docFile, docFileName }) => {
    patchData({ docFile, docFileName })
    startBackgroundUpload('doc', docFile) // upload now, in the background
    addMsg('user', 'text', { text: docFile ? t('Supporting document ready ✓') : t('Skipped') })
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
      const uploadFailures = []

      // Media started uploading in the background the moment each file was
      // picked, so by now they are usually finished. Await those promises in
      // parallel (fall back to uploading here if one was never started). Note:
      // d.photoUrl is only a local preview — never send it as the stored URL.
      const resolveUpload = async (kind, file, externalUrl) => {
        if (!file) return externalUrl || ''
        let entry = uploadsRef.current[kind]
        if (!entry || entry.file !== file) { startBackgroundUpload(kind, file); entry = uploadsRef.current[kind] }
        try { return (await entry.promise) || '' }
        catch (err) { console.error(`[${kind} upload error]`, err); uploadFailures.push(t(kind)); return '' }
      }

      const anyPending = d.photoFile || d.videoFile || d.docFile
      if (anyPending) await botSay(t('📤 Finalising your uploads...'), 150)

      const [finalPhotoUrl, finalVideoUrl, finalDocUrl] = await Promise.all([
        resolveUpload('photo', d.photoFile, ''),
        resolveUpload('video', d.videoFile, d.videoUrl),
        resolveUpload('doc', d.docFile, d.documentUrl),
      ])

      await botSay(t('📝 Submitting your application...'), 150)

      const payload = {
        mobile: mobileRef.current,
        membership_id: d.membershipId,
        photo_url: finalPhotoUrl,
        video_url: finalVideoUrl,
        document_url: finalDocUrl,
        development_priorities: d.devPriorities,
        grievance_plan: d.grievancePlan,
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
        if (uploadFailures.length) {
          await botSay(`⚠️ ${t('Your application was submitted, but these uploads did not go through:')} ${uploadFailures.join(', ')}. ${t('You can add them later.')}`, 300)
        }
        await botSay(t('🎉 Submit Application — done!'), 250)
        addMsg('bot', 'submitted', {
          result: {
            application_id: res.application_id,
            submitted_at: res.submitted_at,
            mobile: res.mobile || mobileRef.current,
            photo_url: finalPhotoUrl,
            voter: d.voter,
            name: d.voter?.name || d.name || 'Candidate',
            epic_no: d.epic,
            position_preferences: d.positionPrefs,
            local_body: d.localBody,
            body_type: d.bodyType,
          },
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
    clearSession()
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
    if (chatState === S.AWAIT_MEMBERSHIP) return !inputValue.trim() // Required

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
      case 'welcome_back_banner':
        return <WelcomeBackBannerMsg name={msg.name || appData.voter?.name} subtitle={msg.subtitle} />
      case 'membership_card':
        return (
          <MembershipCardMsg
            active={isLatest && chatState === S.AWAIT_MEMBERSHIP}
            onSubmit={(customVal, skipped) => handleMembershipSubmit(customVal, skipped)}
            disabled={isTyping}
          />
        )
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
      case 'district':
        return (
          <DistrictMsg
            active={isLatest && chatState === S.DISTRICT}
            initial={appData.contestDistrict}
            defaultDistrict={appData.voter?.district}
            onSubmit={handleDistrictSubmit}
            disabled={isTyping}
          />
        )
      case 'photo_upload':
        return (
          <PhotoUploadMsg
            active={isLatest && chatState === S.PHOTO_UPLOAD}
            initial={{ photoUrl: appData.photoUrl }}
            onSubmit={handlePhotoSubmit}
            disabled={isTyping}
          />
        )


      case 'local_body':
        return (
          <LocalBodyMsg
            active={isLatest && chatState === S.LOCAL_BODY}
            contestDistrict={appData.contestDistrict || appData.voter?.district || 'Chennai'}
            initial={{ bodyType: appData.bodyType, localBody: appData.localBody, positionPrefs: appData.positionPrefs }}
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
      case 'video_upload':
        return (
          <VideoUploadMsg
            active={isLatest && chatState === S.VIDEO_UPLOAD}
            initial={{ videoUrl: appData.videoUrl, videoFile: appData.videoFile, videoFileName: appData.videoFileName }}
            onSubmit={handleVideoSubmit}
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
            expectText="We expect details of your political involvement, party roles, public service, election campaign experience, or community leadership."
            sampleText="Served as BJP Ward General Secretary for 3 years. Organized 20+ booth-level mobilization meetings, led Yuva Morcha membership drives, managed polling agents during assembly elections, and regularly petition local authorities for public civic issues."
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
            expectText="We expect an analysis of key local issues (water, roads, sanitation, street lights, youth employment) in your ward/panchayat and your proposed solutions if elected."
            initial={appData.localArea}
            onSubmit={handleLocalAreaSubmit}
            disabled={isTyping}
          />
        )

      case 'short_texts':
        return (
          <ShortTextsMsg
            active={isLatest && chatState === S.SHORT_TEXTS}
            initial={{ devPriorities: appData.devPriorities, grievancePlan: appData.grievancePlan }}
            onSubmit={handleShortTextsSubmit}
            disabled={isTyping}
          />
        )
      case 'doc_upload':
        return (
          <DocUploadMsg
            active={isLatest && chatState === S.DOC_UPLOAD}
            initial={{ docFile: appData.docFile, docFileName: appData.docFileName }}
            onSubmit={handleDocUploadSubmit}
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
        return <SubmittedMsg result={msg.result} alreadyApplied={msg.alreadyApplied} appData={appData} />

      default:
        return <span>{msg.text || ''}</span>
    }
  }

  const inputCfg = getInputCfg()
  const wideTypes = ['voter_card', 'membership_card', 'photo_upload', 'video_upload', 'short_texts', 'doc_upload', 'welcome_banner', 'welcome_back_banner', 'local_body', 'position', 'social', 'work', 'local_area', 'review', 'submitted']




  return (
    <div className="chatbot-app bjp-theme">
      <div className="chatbot-fullpage">
        <div className="chatbot-container">
          <header className="chat-header saffron-header">
            <div className="chat-header-avatar">
              <img
                src="/logo.png"
                alt="BJP Logo"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/bjp_logo.png';
                }}
              />
            </div>

            {/* Language toggle: English / Tamil */}
            <div className="lang-toggle" role="group" aria-label="Language">
              <button
                type="button"
                className={`lang-toggle-btn${lang === 'en' ? ' active' : ''}`}
                onClick={() => setLang('en')}
                aria-pressed={lang === 'en'}
              >
                EN
              </button>
              <button
                type="button"
                className={`lang-toggle-btn${lang === 'ta' ? ' active' : ''}`}
                onClick={() => setLang('ta')}
                aria-pressed={lang === 'ta'}
              >
                தமிழ்
              </button>
            </div>

            <div className="header-social-wrapper" style={{ position: 'relative' }}>
              {/* Social Media Share Toggle Button for Mobile view */}
              <button
                type="button"
                className={`social-icon-btn mobile-social-toggle ${showSocialMenu ? 'active' : ''}`}
                onClick={() => setShowSocialMenu((prev) => !prev)}
                title={t('Official Social Media Channels')}
                aria-label="Social Media Menu"
                aria-expanded={showSocialMenu}
              >
                <i className="bi bi-share-fill" style={{ fontSize: 16 }} />
                <i className="bi bi-chevron-down mobile-social-caret" />
              </button>

              {/* Desktop direct row of social media icons */}
              <div className="header-social-icons desktop-social-icons">
                <a href="https://www.facebook.com/BJP4TamilNadu/" target="_blank" rel="noopener noreferrer" className="social-icon-btn facebook" title="Facebook" aria-label="Facebook">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a href="https://x.com/BJP4TamilNadu" target="_blank" rel="noopener noreferrer" className="social-icon-btn twitter" title="Twitter / X" aria-label="Twitter">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
                <a href="https://www.instagram.com/bjp4tamilnadu/?hl=en" target="_blank" rel="noopener noreferrer" className="social-icon-btn instagram" title="Instagram" aria-label="Instagram">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                <a href="https://www.youtube.com/@bjp4tamilnad" target="_blank" rel="noopener noreferrer" className="social-icon-btn youtube" title="YouTube" aria-label="YouTube">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </a>
              </div>

              {/* Mobile Social Media Popup Dropdown */}
              {showSocialMenu && (
                <>
                  <div className="social-dropdown-backdrop" onClick={() => setShowSocialMenu(false)} />
                  <div className="social-dropdown-menu">
                    <div className="social-dropdown-header">
                      <span>{t('Official Channels')}</span>
                      <button type="button" className="social-dropdown-close" onClick={() => setShowSocialMenu(false)}>
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>

                    {/* Language toggle (mobile) */}
                    <div className="social-dropdown-lang">
                      <span className="social-dropdown-lang-label"><i className="bi bi-translate" /> Language / மொழி</span>
                      <div className="social-dropdown-lang-toggle">
                        <button
                          type="button"
                          className={`lang-toggle-btn${lang === 'en' ? ' active' : ''}`}
                          onClick={() => { setLang('en'); setShowSocialMenu(false) }}
                          aria-pressed={lang === 'en'}
                        >
                          EN
                        </button>
                        <button
                          type="button"
                          className={`lang-toggle-btn${lang === 'ta' ? ' active' : ''}`}
                          onClick={() => { setLang('ta'); setShowSocialMenu(false) }}
                          aria-pressed={lang === 'ta'}
                        >
                          தமிழ்
                        </button>
                      </div>
                    </div>

                    <div className="social-dropdown-list">
                      <a href="https://www.facebook.com/BJP4TamilNadu/" target="_blank" rel="noopener noreferrer" className="social-dropdown-item facebook" onClick={() => setShowSocialMenu(false)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        <span>Facebook</span>
                      </a>
                      <a href="https://x.com/BJP4TamilNadu" target="_blank" rel="noopener noreferrer" className="social-dropdown-item twitter" onClick={() => setShowSocialMenu(false)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Twitter / X</span>
                      </a>
                      <a href="https://www.instagram.com/bjp4tamilnadu/?hl=en" target="_blank" rel="noopener noreferrer" className="social-dropdown-item instagram" onClick={() => setShowSocialMenu(false)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                        <span>Instagram</span>
                      </a>
                      <a href="https://www.youtube.com/@bjp4tamilnad" target="_blank" rel="noopener noreferrer" className="social-dropdown-item youtube" onClick={() => setShowSocialMenu(false)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        <span>YouTube</span>
                      </a>
                    </div>
                  </div>
                </>
              )}
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

          {/* Input area — render only when an active text/number input is required */}
          {inputCfg && (
            <footer className="chat-input-area">
              {chatState === S.AWAIT_MEMBERSHIP && (
                <div className="membership-quick-bar" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'var(--color-abyss)',
                  border: '1px solid var(--color-graphite)',
                  borderRadius: 10,
                  width: '100%',
                  boxSizing: 'border-box',
                  gap: 8,
                }}>
                  <a
                    href="https://membership.bjp.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: 'var(--color-signal-mint)', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.3 }}
                  >
                    <i className="bi bi-box-arrow-up-right" style={{ flexShrink: 0 }} />
                    <span>{t("Aren't a BJP member? Apply Online")}</span>
                  </a>
                </div>
              )}

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
            </footer>
          )}
        </div>
      </div>
    </div>
  )
}
