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

// CORS — allow the configured client origin (Vite dev server on :3000).
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000'
app.use(cors({ origin: clientOrigin, credentials: true }))

app.use(express.json({ limit: '1mb' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

app.get('/health', (req, res) =>
  res.json({ ok: true, voterDb: isVoterDbOnline(), appDb: isAppDbOnline() })
)

app.use('/api', apiRoutes)
app.use('/admin/api', adminRoutes)

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found.' }))

const PORT = process.env.PORT || 5000

function validateEnv() {
  const missing = ['MONGO_VOTER_URL', 'MONGO_APP_URL', 'SMS_API_KEY'].filter((k) => !process.env[k])
  if (missing.length) {
    console.error(`[bjp] FATAL: missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
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
