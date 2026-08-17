import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { connectDbs, closeDbs, isVoterDbOnline, isAppDbOnline } from './config/db.js'
import apiRoutes from './routes/index.js'
import adminRoutes from './routes/admin.js'

const app = express()

app.set('trust proxy', 1)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

// CORS — allow one or more client origins (comma-separated in CLIENT_ORIGIN).
// Trailing slashes are tolerated. Defaults cover the Vercel frontend + local dev.
const allowedOrigins = (process.env.CLIENT_ORIGIN ||
  'https://bjp-mebership.vercel.app,http://localhost:3000')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean)

app.use(cors({
  origin(origin, cb) {
    // Non-browser requests (curl, health checks, same-origin) have no Origin.
    if (!origin) return cb(null, true)
    const clean = origin.replace(/\/+$/, '')
    return cb(null, allowedOrigins.includes(clean))
  },
  credentials: true,
}))

app.use(express.json({ limit: '1mb' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

app.get('/', (req, res) =>
  res.json({
    service: 'BJP Tamil Nadu — Local Body Application API',
    status: 'ok',
    voterDb: isVoterDbOnline(),
    appDb: isAppDbOnline(),
    endpoints: ['/health', '/api/*', '/admin/api/*'],
  })
)

app.get('/health', (req, res) =>
  res.json({ ok: true, voterDb: isVoterDbOnline(), appDb: isAppDbOnline() })
)

app.use('/api', apiRoutes)
app.use('/admin/api', adminRoutes)

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found.' }))

const defaultPort = process.env.NODE_ENV === 'production' ? 10000 : 5000
const rawPort = parseInt(process.env.PORT || String(defaultPort), 10)
const PORT = (!isNaN(rawPort) && rawPort >= 1 && rawPort <= 65535) ? rawPort : defaultPort

function validateEnv() {
  const missingRequired = ['MONGO_VOTER_URL', 'MONGO_APP_URL'].filter((k) => !process.env[k])
  if (missingRequired.length) {
    console.error(`[bjp] FATAL: missing required environment variables: ${missingRequired.join(', ')}`)
    process.exit(1)
  }
  if (!process.env.SMS_API_KEY) {
    console.warn(`[bjp] WARNING: SMS_API_KEY is not set. Dev OTP bypass (123456) will be used for testing.`)
  }
}

;(async () => {
  validateEnv()
  await connectDbs()
  const server = app.listen(PORT, () => console.log(`[bjp] API listening on http://localhost:${PORT}`))
  const shutdown = async () => { await closeDbs(); server.close(() => process.exit(0)) }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
})()
