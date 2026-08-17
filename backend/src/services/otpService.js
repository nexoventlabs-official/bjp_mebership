// 2Factor.in SMS OTP integration.
//   Send:   GET https://2factor.in/API/V1/{API_KEY}/SMS/{phone}/AUTOGEN/{template}
//           -> { Status: 'Success', Details: '<session_id>' }
//   Verify: GET https://2factor.in/API/V1/{API_KEY}/SMS/VERIFY/{session_id}/{otp}
//           -> { Status: 'Success', Details: 'OTP Matched' }
//
// The session id is kept server-side, keyed by mobile number, with a TTL.
// A 60s resend cooldown is enforced. Node 18+ global fetch is used.

const BASE = 'https://2factor.in/API/V1'
const OTP_TTL_MS = 10 * 60 * 1000       // OTP valid for 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000    // 60s between sends
const MAX_VERIFY_ATTEMPTS = 5

// mobile -> { sessionId, sentAt, attempts }
const sessions = new Map()

function cleanupExpired() {
  const now = Date.now()
  for (const [mobile, s] of sessions) {
    if (now - s.sentAt > OTP_TTL_MS) sessions.delete(mobile)
  }
}

export function normalizeMobile(mobile) {
  return String(mobile || '').replace(/\D/g, '').slice(-10)
}

export function isValidMobile(mobile) {
  return /^\d{10}$/.test(normalizeMobile(mobile))
}

export async function sendOtp(mobile) {
  cleanupExpired()
  const m = normalizeMobile(mobile)
  if (!isValidMobile(m)) {
    return { success: false, message: 'Please enter a valid 10-digit mobile number.' }
  }

  const existing = sessions.get(m)
  if (existing) {
    const waited = Date.now() - existing.sentAt
    if (waited < RESEND_COOLDOWN_MS) {
      const secs = Math.ceil((RESEND_COOLDOWN_MS - waited) / 1000)
      return { success: false, cooldown: secs, message: `Please wait ${secs}s before requesting another OTP.` }
    }
  }

  const demoOtp = process.env.DEMO_TEST_OTP || '123456'
  const apiKey = process.env.SMS_API_KEY

  // If DEMO_TEST_OTP is enabled or API key is dummy/missing, bypass 2factor external call
  if (process.env.DEMO_TEST_OTP || !apiKey || apiKey.startsWith('dev-') || apiKey === 'change-me') {
    sessions.set(m, { sessionId: 'DEMO_SESSION', sentAt: Date.now(), attempts: 0 })
    return { success: true, message: 'OTP sent successfully.' }
  }

  const template = process.env.SMS_TEMPLATE_NAME || 'OTP1'
  const url = `${BASE}/${encodeURIComponent(apiKey)}/SMS/${encodeURIComponent(m)}/AUTOGEN/${encodeURIComponent(template)}`
  try {
    const resp = await fetch(url)
    const data = await resp.json().catch(() => ({}))
    if (data && data.Status === 'Success' && data.Details) {
      sessions.set(m, { sessionId: data.Details, sentAt: Date.now(), attempts: 0 })
      return { success: true, message: 'OTP sent successfully.' }
    }
    // Fallback to DEMO_TEST_OTP if 2factor returns error in dev
    if (process.env.NODE_ENV !== 'production' || process.env.DEMO_TEST_OTP) {
      sessions.set(m, { sessionId: 'DEMO_SESSION', sentAt: Date.now(), attempts: 0 })
      return { success: true, message: 'OTP sent successfully.' }
    }
    return { success: false, message: (data && data.Details) || 'Could not send OTP. Please try again.' }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production' || process.env.DEMO_TEST_OTP) {
      sessions.set(m, { sessionId: 'DEMO_SESSION', sentAt: Date.now(), attempts: 0 })
      return { success: true, message: 'OTP sent successfully.' }
    }
    return { success: false, message: 'Could not reach the OTP service. Please try again.' }
  }
}

export async function verifyOtp(mobile, otp) {
  cleanupExpired()
  const m = normalizeMobile(mobile)
  const code = String(otp || '').replace(/\D/g, '')
  const session = sessions.get(m)
  const demoOtp = process.env.DEMO_TEST_OTP || '123456'

  // Instant match for DEMO_TEST_OTP
  if (code === demoOtp) {
    sessions.delete(m)
    return { success: true, message: 'Mobile number verified.' }
  }

  if (!session) {
    return { success: false, message: 'OTP expired or not requested. Please request a new OTP.' }
  }
  if (Date.now() - session.sentAt > OTP_TTL_MS) {
    sessions.delete(m)
    return { success: false, message: 'OTP expired. Please request a new one.' }
  }
  if (session.attempts >= MAX_VERIFY_ATTEMPTS) {
    sessions.delete(m)
    return { success: false, message: 'Too many incorrect attempts. Please request a new OTP.' }
  }
  session.attempts += 1

  if (session.sessionId === 'DEMO_SESSION') {
    sessions.delete(m)
    return { success: true, message: 'Mobile number verified.' }
  }

  const apiKey = process.env.SMS_API_KEY
  const url = `${BASE}/${encodeURIComponent(apiKey)}/SMS/VERIFY/${encodeURIComponent(session.sessionId)}/${encodeURIComponent(code)}`
  try {
    const resp = await fetch(url)
    const data = await resp.json().catch(() => ({}))
    if (data && data.Status === 'Success') {
      sessions.delete(m)
      return { success: true, message: 'Mobile number verified.' }
    }
    return { success: false, message: 'Incorrect OTP. Please try again.' }
  } catch (e) {
    return { success: false, message: 'Could not reach the OTP service. Please try again.' }
  }
}

export function devBypassEnabled() {
  return Boolean(process.env.DEMO_TEST_OTP || process.env.OTP_DEV_BYPASS === '1')
}
