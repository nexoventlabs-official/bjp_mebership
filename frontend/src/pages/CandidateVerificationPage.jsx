import React, { useEffect, useState, useRef } from 'react'
import { useSearchParams, useParams, Link } from 'react-router-dom'
import html2canvas from 'html2canvas'
import QRCode from 'qrcode'
import { getApplication } from '../api'
import { useLang } from '../i18n/LanguageContext'

export default function CandidateVerificationPage() {
  const { lang, setLang, t } = useLang()
  const [searchParams, setSearchParams] = useSearchParams()
  const { id: routeId } = useParams()
  const appId = searchParams.get('app_id') || searchParams.get('id') || routeId || ''
  const urlLang = searchParams.get('lang')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [appData, setAppData] = useState(null)
  const [qrUrl, setQrUrl] = useState('')
  const [downloading, setDownloading] = useState(false)
  const cardRef = useRef(null)

  const handleSwitchLang = (newLang) => {
    if (setLang) setLang(newLang)
    const newParams = new URLSearchParams(searchParams)
    newParams.set('lang', newLang)
    setSearchParams(newParams, { replace: true })
  }

  useEffect(() => {
    if (urlLang && (urlLang === 'ta' || urlLang === 'en') && setLang) {
      setLang(urlLang)
    }
  }, [urlLang, setLang])

  useEffect(() => {
    if (!appId) {
      setLoading(false)
      setError('No Application ID provided.')
      return
    }

    setLoading(true)
    setError('')

    getApplication(appId)
      .then((res) => {
        const app = res?.application || res?.data?.application
        if (app) {
          setAppData(app)
        } else {
          setError('Candidate application record not found.')
        }
      })
      .catch((err) => {
        console.error('[Verification Error]', err)
        setError('Unable to fetch candidate application details. Please check the Application ID.')
      })
      .finally(() => setLoading(false))
  }, [appId])

  // Extract variables
  const candName = appData?.voter?.name || 'Candidate'
  const epicNo = appData?.voter?.epic_no || appData?.epic_no || 'N/A'
  const photoUrl = appData?.photo_url || appData?.photoUrl || appData?.photo_preview || appData?.voter?.photo || ''
  const candidateImg = photoUrl && photoUrl.trim() ? photoUrl : '/bjp_logo.png'
  const posPrefs = appData?.position_preferences || []
  const primaryPos = posPrefs[0] || 'Local Body Candidate'

  // Location summary
  const getLbSummary = () => {
    if (!appData) return 'Tamil Nadu Local Body'
    // The backend stores location under `local_body` (not `ward_details`).
    const lb = appData.local_body || {}
    if (appData.body_type === 'urban') {
      const type = lb.local_body_type || 'Urban Local Body'
      const name = lb.local_body || ''
      const ward = lb.ward || ''
      return [type, name, ward ? `Ward ${ward}` : ''].filter(Boolean).join(' - ')
    }
    const union = lb.panchayat_union || ''
    const panchayat = lb.village_panchayat || ''
    const ward = lb.ward || ''
    return [union, panchayat, ward ? `Ward ${ward}` : ''].filter(Boolean).join(' - ')
  }

  const lbSummary = getLbSummary()

  // Format Timestamp
  const formattedTime = appData?.submitted_at
    ? new Date(appData.submitted_at).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      })
    : 'Official Entry 2026-27'

  // Generate QR Code payload pointing to current verification page
  useEffect(() => {
    if (appId) {
      const currentUrl = window.location.href
      QRCode.toDataURL(currentUrl, { margin: 1, width: 140, color: { dark: '#0F172A', light: '#FFFFFF' } })
        .then(setQrUrl)
        .catch(() => {})
    }
  }, [appId])

  const [sharing, setSharing] = useState(false)

  // Download Card PNG
  const handleDownload = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f76201',
      })
      const image = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = image
      link.download = `BJP_Candidate_Card_${appId}.png`
      link.click()
    } catch (err) {
      console.error('Download error:', err)
      alert('Failed to download card. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  // Share Card PNG Image directly on WhatsApp / Native Share
  const handleShareWhatsApp = async () => {
    if (!cardRef.current) return
    setSharing(true)
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f76201',
      })
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setSharing(false)
          return
        }
        const fileName = `BJP_Candidate_Card_${appId || '2026'}.png`
        const file = new File([blob], fileName, { type: 'image/png' })

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `BJP Candidate Card - ${candName}`,
            })
          } catch (_) { /* User cancelled share */ }
        } else {
          // Fallback: download PNG file and prompt user for WhatsApp share
          const link = document.createElement('a')
          link.href = URL.createObjectURL(blob)
          link.download = fileName
          link.click()
          window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out my BJP Tamil Nadu Local Body Elections 2026-27 Candidate Card for ${candName}!`)}`, '_blank')
        }
        setSharing(false)
      }, 'image/png')
    } catch (err) {
      console.error('Share error:', err)
      setSharing(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F172A',
      color: '#FFFFFF',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px',
      boxSizing: 'border-box'
    }}>
      {/* Top Header Navigation */}
      <header style={{
        width: '100%',
        maxWidth: 440,
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        marginBottom: 20,
        padding: '12px 16px',
        background: '#1E293B',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/bjp_logo.png" alt="BJP Logo" style={{ width: 36, height: 36, objectFit: 'contain' }} onError={(e) => { e.target.src = '/bjp_logo.svg' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#f76201', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              BHARATIYA JANATA PARTY
            </div>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>
              Official Verification Portal 2026-27
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="lang-toggle" role="group" aria-label="Language" style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 2, border: '1px solid rgba(255,255,255,0.15)' }}>
            <button
              type="button"
              className={`lang-toggle-btn${lang === 'en' ? ' active' : ''}`}
              onClick={() => handleSwitchLang('en')}
              style={{
                background: lang === 'en' ? '#f76201' : 'transparent',
                color: '#FFF', border: 'none', borderRadius: 12, padding: '4px 10px',
                fontSize: 11, fontWeight: 700, cursor: 'pointer'
              }}
            >
              EN
            </button>
            <button
              type="button"
              className={`lang-toggle-btn${lang === 'ta' ? ' active' : ''}`}
              onClick={() => handleSwitchLang('ta')}
              style={{
                background: lang === 'ta' ? '#f76201' : 'transparent',
                color: '#FFF', border: 'none', borderRadius: 12, padding: '4px 10px',
                fontSize: 11, fontWeight: 700, cursor: 'pointer'
              }}
            >
              தமிழ்
            </button>
          </div>
          <Link to="/" style={{
            fontSize: 12,
            color: '#f76201',
            textDecoration: 'none',
            fontWeight: 700,
            background: 'rgba(247, 98, 1, 0.12)',
            padding: '6px 12px',
            borderRadius: 20,
            border: '1px solid rgba(247, 98, 1, 0.3)'
          }}>
            Apply Now →
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              width: 44, height: 44, border: '4px solid #f76201', borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px'
            }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#E2E8F0' }}>
              Verifying Candidate Credentials...
            </div>
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #EF4444',
            borderRadius: 16,
            padding: 24,
            textAlign: 'center',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#FCA5A5', marginBottom: 6 }}>
              Record Not Found
            </h2>
            <p style={{ fontSize: 13, color: '#CBD5E1', lineHeight: 1.5, marginBottom: 16 }}>
              {error}
            </p>
            <Link to="/" style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #f76201 0%, #d85400 100%)',
              color: '#FFF',
              padding: '10px 20px',
              borderRadius: 12,
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: 13
            }}>
              Go to Candidate Application Portal
            </Link>
          </div>
        )}

        {!loading && !error && appData && (
          <>
            {/* Status Verification Banner */}
            <div style={{
              width: '100%',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              borderRadius: 16,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              marginBottom: 20,
              boxShadow: '0 8px 24px rgba(4, 120, 87, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, background: '#FFFFFF', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, color: '#059669', fontWeight: 900, flexShrink: 0
                }}>
                  ✓
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 900, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    VERIFIED CANDIDATE RECORD
                  </div>
                  <div style={{ fontSize: 11, color: '#D1FAE5', fontWeight: 600, marginTop: 2 }}>
                    Verified Record in BJP TN Local Body Election Database
                  </div>
                </div>
              </div>
            </div>

            {/* 9:16 Aspect Ratio Official BJP Candidate Poster Card */}
            <div
              ref={cardRef}
              style={{
                width: '100%',
                maxWidth: 360,
                aspectRatio: '9 / 16',
                background: 'linear-gradient(165deg, #f76201 0%, #d85400 100%)',
                border: '3px solid #f76201',
                borderRadius: 22,
                boxShadow: '0 16px 40px rgba(247, 98, 1, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '18px 14px',
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
                <img src="/bjp_logo.png" alt="" style={{ width: 280 }} onError={(e) => { e.target.src = '/bjp_logo.svg' }} />
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
                  <div style={{ fontSize: 12.5, fontWeight: 900, letterSpacing: '0.03em', color: '#f76201', textTransform: 'uppercase' }}>
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
                  <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.01em', textShadow: '0 2px 4px rgba(0,0,0,0.25)' }}>
                    {candName}
                  </div>
                </div>
              </div>

              {/* Details Box (Pure White Panel) */}
              <div style={{
                background: '#FFFFFF', color: '#0F172A',
                borderRadius: 14, padding: '12px', display: 'flex', flexDirection: 'column', gap: 6,
                fontSize: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.15)', zIndex: 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 5 }}>
                  <span style={{ color: '#64748B', fontSize: 11.5, fontWeight: 500 }}>Application ID</span>
                  <span style={{ fontWeight: 900, color: '#f76201', fontFamily: 'monospace', fontSize: 13 }}>{appData.application_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 5 }}>
                  <span style={{ color: '#64748B', fontSize: 11.5, fontWeight: 500 }}>EPIC / Voter ID</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{epicNo}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 5 }}>
                  <span style={{ color: '#64748B', fontSize: 11.5, fontWeight: 500 }}>Contest Preference</span>
                  <span style={{ fontWeight: 700, color: '#d85400' }}>{primaryPos}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748B', fontSize: 11.5, fontWeight: 500 }}>Local Body Ward</span>
                  <span style={{ fontWeight: 700, color: '#0F172A', fontSize: 9, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 210 }}>{lbSummary}</span>
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

              {/* Card Footer Box (Pure White Panel) */}
              <div style={{
                background: '#FFFFFF', color: '#0F172A',
                borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', boxShadow: '0 4px 14px rgba(0,0,0,0.15)', zIndex: 1
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 8, color: '#64748B', fontWeight: 500 }}>Submitted Timestamp</span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#0F172A' }}>{formattedTime}</span>
                  <span style={{ fontSize: 8, color: '#f76201', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                    🛡️ Official Party Verification 2026-27
                  </span>
                </div>
                {qrUrl && (
                  <a href={window.location.href} target="_blank" rel="noopener noreferrer" title="Click to open verification link">
                    <div style={{ background: '#FFF', padding: 2, borderRadius: 6, border: '1px solid #E2E8F0', display: 'flex', cursor: 'pointer' }}>
                      <img src={qrUrl} alt="Verification QR Code" style={{ width: 46, height: 46 }} />
                    </div>
                  </a>
                )}
              </div>
            </div>

            {/* Action Buttons: View & Download Card */}
            <div style={{ width: '100%', maxWidth: 360, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={handleDownload}
                disabled={downloading}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #f76201 0%, #d85400 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 14,
                  padding: '14px',
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  boxShadow: '0 6px 20px rgba(247, 98, 1, 0.4)',
                  transition: 'all 0.2s ease',
                  opacity: downloading ? 0.8 : 1
                }}
              >
                {downloading ? 'Generating High-Res Card Image...' : '📥 Download Candidate Card (PNG)'}
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                disabled={sharing || downloading}
                style={{
                  width: '100%',
                  background: '#25D366',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 14,
                  padding: '13px',
                  fontSize: 14.5,
                  fontWeight: 800,
                  cursor: (sharing || downloading) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)',
                  boxSizing: 'border-box',
                  opacity: (sharing || downloading) ? 0.8 : 1
                }}
              >
                💬 {sharing ? 'Preparing PNG Card to Share...' : 'Share Card PNG Image on WhatsApp'}
              </button>
            </div>
          </>
        )}
      </main>

      {/* Footer copyright */}
      <footer style={{ marginTop: 32, textAlign: 'center', fontSize: 11, color: '#64748B' }}>
        © 2026 Bharatiya Janata Party Tamil Nadu • Local Body Elections Candidate Portal
      </footer>
    </div>
  )
}
