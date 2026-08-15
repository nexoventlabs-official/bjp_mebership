import { sendOtp, verifyOtp, normalizeMobile, isValidMobile, devBypassEnabled } from '../services/otpService.js'
import { findVoterByEpic, toVoterProfile, isValidEpic, normalizeEpic } from '../models/voterModel.js'
import { createApplication, findApplicationById, findLatestApplicationByMobile } from '../models/applicationModel.js'
import { isVoterDbOnline, isAppDbOnline } from '../config/db.js'
import { positionsFor, URBAN_BODY_TYPES } from '../constants/localBodies.js'

// ── OTP ────────────────────────────────────────────────────────────
export async function postSendOtp(req, res) {
  const mobile = normalizeMobile(req.body?.mobile)
  if (!isValidMobile(mobile)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number.' })
  }
  const result = await sendOtp(mobile)
  return res.status(result.success ? 200 : 400).json(result)
}

export async function postVerifyOtp(req, res) {
  const mobile = normalizeMobile(req.body?.mobile)
  const otp = String(req.body?.otp || '').trim()
  if (!isValidMobile(mobile)) {
    return res.status(400).json({ success: false, message: 'Invalid mobile number.' })
  }
  if (!/^\d{4,8}$/.test(otp)) {
    return res.status(400).json({ success: false, message: 'Please enter the OTP sent to your mobile.' })
  }
  // Local dev bypass (no SMS credits): accept 123456
  const verified = (devBypassEnabled() && otp === '123456')
    ? { success: true, message: 'Mobile number verified (dev).' }
    : await verifyOtp(mobile, otp)

  if (!verified.success) {
    return res.status(400).json(verified)
  }

  // If this mobile already has a submitted application, tell the client so it
  // can show the "already submitted" message instead of starting a new flow.
  try {
    if (isAppDbOnline()) {
      const existing = await findLatestApplicationByMobile(mobile)
      if (existing) {
        return res.json({
          success: true,
          message: verified.message,
          already_applied: true,
          application: {
            application_id: existing.application_id,
            submitted_at: existing.submitted_at,
            mobile: existing.mobile,
          },
        })
      }
    }
  } catch (_) { /* non-fatal — proceed as a new applicant */ }

  return res.json({ success: true, message: verified.message, already_applied: false })
}

// ── Voter lookup by EPIC ───────────────────────────────────────────
export async function postLookupVoter(req, res) {
  if (!isVoterDbOnline()) {
    return res.status(503).json({ success: false, message: 'Voter database is temporarily unavailable. Please try again shortly.' })
  }
  const epic = normalizeEpic(req.body?.epic_no)
  if (!isValidEpic(epic)) {
    return res.status(400).json({ success: false, message: 'Invalid EPIC / Voter ID format. Example: ABC1234567' })
  }
  try {
    const found = await findVoterByEpic(epic)
    if (!found) {
      return res.status(404).json({ success: false, message: 'No voter found for this EPIC / Voter ID. Please re-check and try again.' })
    }
    const voter = toVoterProfile(found.voter, found.assembly_no)
    return res.json({ success: true, voter })
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Could not look up voter details. Please try again.' })
  }
}

// ── Submit application ─────────────────────────────────────────────
const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i
const countWords = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length

export async function postSubmitApplication(req, res) {
  if (!isAppDbOnline()) {
    return res.status(503).json({ success: false, message: 'Application service is temporarily unavailable. Please try again shortly.' })
  }
  const body = req.body || {}

  const mobile = normalizeMobile(body.mobile)
  if (!isValidMobile(mobile)) {
    return res.status(400).json({ success: false, message: 'A verified mobile number is required.' })
  }

  const membershipId = String(body.membership_id || '').trim()
  if (!membershipId) {
    return res.status(400).json({ success: false, message: 'BJP Membership ID is required.' })
  }

  const epic = normalizeEpic(body.epic_no)
  if (!isValidEpic(epic)) {
    return res.status(400).json({ success: false, message: 'A valid EPIC / Voter ID is required.' })
  }

  const bodyType = String(body.body_type || '').toLowerCase()
  if (!['rural', 'urban'].includes(bodyType)) {
    return res.status(400).json({ success: false, message: 'Select a valid local body type (rural or urban).' })
  }

  // Local body location details. Urban: type + local body + ward.
  // Rural: three manual fields (panchayat union, village panchayat, ward).
  const lbIn = body.local_body && typeof body.local_body === 'object' ? body.local_body : {}
  let localBody
  if (bodyType === 'urban') {
    const localBodyType = String(lbIn.local_body_type || '').trim()
    const bodyName = String(lbIn.local_body || '').trim()
    const ward = String(lbIn.ward || '').trim()
    if (!URBAN_BODY_TYPES.includes(localBodyType)) {
      return res.status(400).json({ success: false, message: 'Select a valid local body type.' })
    }
    if (!bodyName) {
      return res.status(400).json({ success: false, message: 'Select your local body.' })
    }
    if (!ward) {
      return res.status(400).json({ success: false, message: 'Enter your ward / area.' })
    }
    localBody = { type: 'urban', local_body_type: localBodyType, local_body: bodyName, ward }
  } else {
    const panchayatUnion = String(lbIn.panchayat_union || '').trim()
    const villagePanchayat = String(lbIn.village_panchayat || '').trim()
    const ward = String(lbIn.ward || '').trim()
    if (!panchayatUnion || !villagePanchayat || !ward) {
      return res.status(400).json({ success: false, message: 'Enter Panchayat Union, Village Panchayat and Ward / Area.' })
    }
    localBody = { type: 'rural', panchayat_union: panchayatUnion, village_panchayat: villagePanchayat, ward }
  }

  // Position preferences: 1st is required and must be a valid position for the
  // body type. 2nd and 3rd are optional free-text entries.
  const validPositions = positionsFor(bodyType)
  const prefsIn = Array.isArray(body.position_preferences) ? body.position_preferences : []
  const prefs = prefsIn.map((p) => String(p || '').trim()).filter(Boolean)
  if (!prefs.length) {
    return res.status(400).json({ success: false, message: 'Select at least your 1st preference position.' })
  }
  if (!validPositions.includes(prefs[0])) {
    return res.status(400).json({ success: false, message: `Invalid 1st preference position for ${bodyType} local body.` })
  }

  // Social media — at least one valid URL required
  const socialIn = body.social_media || {}
  const social = {}
  for (const key of ['facebook', 'instagram', 'twitter', 'youtube']) {
    const v = String(socialIn[key] || '').trim()
    if (v) {
      if (!URL_RE.test(v)) {
        return res.status(400).json({ success: false, message: `Please enter a valid ${key} URL.` })
      }
      social[key] = v
    }
  }
  // Social media is optional — no minimum required. Any entered URLs are validated above.

  const workExperience = String(body.work_experience || '').trim()
  if (!workExperience) {
    return res.status(400).json({ success: false, message: 'Please share your work / experience.' })
  }
  if (countWords(workExperience) > 500) {
    return res.status(400).json({ success: false, message: 'Work / experience must be 500 words or fewer.' })
  }

  const localAreaUnderstanding = String(body.local_area_understanding || '').trim()
  if (!localAreaUnderstanding) {
    return res.status(400).json({ success: false, message: 'Please tell us about your area — key issues and what you want to change.' })
  }
  if (countWords(localAreaUnderstanding) > 500) {
    return res.status(400).json({ success: false, message: 'Local area understanding must be 500 words or fewer.' })
  }

  // Voter snapshot (as confirmed in the flow) — optional, stored for reference.
  const voter = body.voter && typeof body.voter === 'object' ? body.voter : null

  try {
    const { application_id, submitted_at } = await createApplication({
      mobile,
      membership_id: membershipId,
      epic_no: epic,
      voter,
      body_type: bodyType,
      local_body: localBody,
      position_preferences: prefs,
      social_media: social,
      work_experience: workExperience,
      local_area_understanding: localAreaUnderstanding,
    })
    return res.json({
      success: true,
      application_id,
      submitted_at,
      mobile,
      message: 'Application submitted successfully.',
    })
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Could not submit your application. Please try again.' })
  }
}

export async function getApplication(req, res) {
  if (!isAppDbOnline()) {
    return res.status(503).json({ success: false, message: 'Application service is temporarily unavailable.' })
  }
  const app = await findApplicationById(req.params.id)
  if (!app) return res.status(404).json({ success: false, message: 'Application not found.' })
  return res.json({ success: true, application: app })
}
