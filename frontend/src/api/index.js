import axios from 'axios'

const api = axios.create({
  // Support VITE_API_URL env var for pointing at staging/production API.
  // Falls back to same-origin (empty string) when not set — works when
  // frontend and backend are co-served, or via the Vite dev proxy.
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  timeout: 30000,
})

// ── Admin bearer token ─────────────────────────────────────────────
// The frontend (Vercel) and backend (Render) live on different domains, so a
// session cookie would be a blocked third-party cookie. Instead the admin login
// returns a signed token that we store and send as an Authorization header.
const ADMIN_TOKEN_KEY = 'bjp_admin_token'
export const getAdminToken = () => {
  try { return localStorage.getItem(ADMIN_TOKEN_KEY) } catch { return null }
}
const setAdminToken = (t) => {
  try { t ? localStorage.setItem(ADMIN_TOKEN_KEY, t) : localStorage.removeItem(ADMIN_TOKEN_KEY) } catch { /* ignore */ }
}

api.interceptors.request.use((cfg) => {
  const url = cfg.url || ''
  // Attach the bearer token to protected admin routes (not the login call).
  if (url.startsWith('/admin/api') && !url.includes('/admin/api/login')) {
    const token = getAdminToken()
    if (token) {
      cfg.headers = cfg.headers || {}
      cfg.headers.Authorization = `Bearer ${token}`
    }
  }
  return cfg
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      // Session invalid/expired — drop the stored admin token.
      if (error.response.status === 401) setAdminToken(null)
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

  sendOrganiserMessage: (data) =>
    api.post('/api/organiser-message', data),

  uploadMedia: (formData) =>
    api.post('/api/upload/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

export const getApplication = (applicationId) =>
  api.get(`/api/application/${applicationId}`)



// ── Admin console API (username/password + bearer token) ──────────
export const admin = {
  login: async (username, password) => {
    const data = await api.post('/admin/api/login', { username, password })
    if (data && data.token) setAdminToken(data.token)
    return data
  },

  logout: async () => {
    try { await api.post('/admin/api/logout') } catch { /* ignore */ }
    setAdminToken(null)
    return { success: true }
  },

  getSession: () =>
    api.get('/admin/api/session'),

  getStats: () =>
    api.get('/admin/api/stats'),

  getReports: (params) =>
    api.get('/admin/api/reports', { params }),

  getApplications: (params) =>
    api.get('/admin/api/applications', { params }),

  getApplication: (id) =>
    api.get(`/admin/api/applications/${id}`),
}

export default api
