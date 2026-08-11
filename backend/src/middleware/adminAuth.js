import crypto from 'crypto'

export const COOKIE_NAME = 'admin_session'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

function secret() {
  return process.env.ADMIN_SESSION_SECRET || 'dev-admin-secret-change-me'
}

// Signed, tamper-proof token: base64url(payload).base64url(hmac)
export function signSession(username) {
  const payload = { u: username, exp: Date.now() + SESSION_TTL_MS }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySession(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

export const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_TTL_MS,
  secure: process.env.NODE_ENV === 'production',
}

export function requireAdmin(req, res, next) {
  const cookies = parseCookies(req.headers.cookie)
  const payload = verifySession(cookies[COOKIE_NAME])
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' })
  }
  req.admin = payload
  next()
}
