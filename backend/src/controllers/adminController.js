import crypto from 'crypto'
import { signSession, COOKIE_NAME, SESSION_COOKIE_OPTS } from '../middleware/adminAuth.js'
import { listApplications, getStats, getTopAssemblies, getReport, findApplicationById } from '../models/applicationModel.js'
import { isAppDbOnline } from '../config/db.js'

// Constant-time string compare to avoid leaking credential length/timing.
function safeEqual(a, b) {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export function postLogin(req, res) {
  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')
  const expectedUser = process.env.ADMIN_USERNAME || 'admin'
  const expectedPass = process.env.ADMIN_PASSWORD || 'admin'

  if (safeEqual(username, expectedUser) && safeEqual(password, expectedPass)) {
    const token = signSession(username)
    // Set a cookie for same-origin setups AND return the token for cross-domain
    // (Vercel <-> Render) where third-party cookies are blocked.
    res.cookie(COOKIE_NAME, token, SESSION_COOKIE_OPTS)
    return res.json({ success: true, token, message: 'Logged in.' })
  }
  return res.status(401).json({ success: false, message: 'Invalid username or password.' })
}

export function getSession(req, res) {
  return res.json({ success: true, user: req.admin?.u || null })
}

export function postLogout(req, res) {
  res.clearCookie(COOKIE_NAME, { ...SESSION_COOKIE_OPTS, maxAge: undefined })
  return res.json({ success: true })
}

export async function getDashboardStats(req, res) {
  if (!isAppDbOnline()) return res.status(503).json({ success: false, message: 'Application database unavailable.' })
  try {
    const [stats, topAssemblies] = await Promise.all([getStats(), getTopAssemblies(10)])
    return res.json({ success: true, ...stats, topAssemblies })
  } catch {
    return res.status(500).json({ success: false, message: 'Could not load stats.' })
  }
}

export async function getApplications(req, res) {
  if (!isAppDbOnline()) return res.status(503).json({ success: false, message: 'Application database unavailable.' })
  try {
    const { search = '', page = 1, page_size = 20 } = req.query
    const result = await listApplications({ search, page, pageSize: page_size })
    return res.json({ success: true, ...result })
  } catch {
    return res.status(500).json({ success: false, message: 'Could not load applications.' })
  }
}

export async function getReports(req, res) {
  if (!isAppDbOnline()) return res.status(503).json({ success: false, message: 'Application database unavailable.' })
  try {
    const { body_type, position, from, to, search, page = 1, page_size = 20 } = req.query
    const result = await getReport({
      bodyType: body_type, position, from, to, search,
      page, pageSize: page_size,
    })
    return res.json({ success: true, ...result })
  } catch {
    return res.status(500).json({ success: false, message: 'Could not load report.' })
  }
}

export async function getApplicationDetail(req, res) {
  if (!isAppDbOnline()) return res.status(503).json({ success: false, message: 'Application database unavailable.' })
  const app = await findApplicationById(req.params.id)
  if (!app) return res.status(404).json({ success: false, message: 'Application not found.' })
  return res.json({ success: true, application: app })
}
