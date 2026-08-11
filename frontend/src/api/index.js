import axios from 'axios'

const api = axios.create({
  // Support VITE_API_URL env var for pointing at staging/production API.
  // Falls back to same-origin (empty string) when not set — works when
  // frontend and backend are co-served, or via the Vite dev proxy.
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  timeout: 30000,
})

// ── CSRF token handling for admin mutating requests ───────────────
let _csrfToken = null
async function ensureCsrfToken() {
  if (_csrfToken) return _csrfToken
  const base = import.meta.env.VITE_API_URL || ''
  const res = await axios.get(base + '/admin/api/csrf-token', { withCredentials: true })
  _csrfToken = res.data && res.data.csrfToken ? res.data.csrfToken : null
  return _csrfToken
}

api.interceptors.request.use(async (cfg) => {
  const url = cfg.url || ''
  const method = (cfg.method || 'get').toLowerCase()
  const mutating = ['post', 'put', 'patch', 'delete'].includes(method)
  const isAdminAuthRoute = url.includes('/admin/api/login') ||
                           url.includes('/admin/api/send-otp') ||
                           url.includes('/admin/api/verify-otp')
  if (mutating && url.startsWith('/admin/api') && !isAdminAuthRoute) {
    try {
      const token = await ensureCsrfToken()
      if (token) {
        cfg.headers = cfg.headers || {}
        cfg.headers['x-csrf-token'] = token
      }
    } catch (_) { /* proceed; server will 403 if token is required */ }
  }
  return cfg
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      if (error.response.status === 403) _csrfToken = null
      return Promise.reject(error.response.data || { message: 'Server error' })
    }
    if (error.code === 'ECONNABORTED') {
      return Promise.reject({ message: 'Request timed out. Please try again.' })
    }
    return Promise.reject({ message: 'Network error. Please check your connection.' })
  }
)

// ── BJP Local Body Candidate Application flow ──────────────────────
export const chat = {
  sendOtp: (mobile) =>
    api.post('/api/send-otp', { mobile }),

  verifyOtp: (mobile, otp) =>
    api.post('/api/verify-otp', { mobile, otp }),

  lookupVoter: (epicNo) =>
    api.post('/api/lookup-voter', { epic_no: epicNo }),

  submitApplication: (data) =>
    api.post('/api/submit-application', data),

  getApplication: (applicationId) =>
    api.get(`/api/application/${applicationId}`),

  // Used by the admin Reports page (districts/assemblies dropdowns).
  getDistrictsData: () =>
    api.get('/api/districts-data'),
}

// ── Admin console API (username/password + applications) ──────────
export const admin = {
  login: (username, password) =>
    api.post('/admin/api/login', { username, password }),

  logout: () =>
    api.post('/admin/api/logout'),

  getSession: () =>
    api.get('/admin/api/session'),

  getStats: () =>
    api.get('/admin/api/stats'),

  getApplications: (params) =>
    api.get('/admin/api/applications', { params }),

  getApplication: (id) =>
    api.get(`/admin/api/applications/${id}`),
}

export default api
