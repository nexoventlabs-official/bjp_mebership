import { getAppDb } from '../config/db.js'

const COLLECTION = 'applications'

// Human-friendly application id: BJP-YYYY-XXXXXX (base36 random, uppercase)
export function generateApplicationId() {
  const year = new Date().getFullYear()
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `BJP-${year}-${rand}`
}

// Insert one application; retries on the rare id collision.
export async function createApplication(doc) {
  const db = getAppDb()
  const coll = db.collection(COLLECTION)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const application_id = generateApplicationId()
    const now = new Date()
    const record = {
      application_id,
      status: 'submitted',
      submitted_at: now,
      ...doc,
    }
    try {
      await coll.insertOne(record)
      return { application_id, submitted_at: now }
    } catch (e) {
      // Duplicate key on application_id — try a fresh id
      if (e && e.code === 11000) continue
      throw e
    }
  }
  throw new Error('Could not allocate a unique application id.')
}

export async function findApplicationById(applicationId) {
  const db = getAppDb()
  return db.collection(COLLECTION).findOne(
    { application_id: String(applicationId).trim().toUpperCase() },
    { projection: { _id: 0 } }
  )
}

// Paginated + searchable list for the admin panel.
export async function listApplications({ search = '', page = 1, pageSize = 20 } = {}) {
  const db = getAppDb()
  const coll = db.collection(COLLECTION)
  const q = {}
  const term = String(search || '').trim()
  if (term) {
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    q.$or = [
      { application_id: { $regex: safe, $options: 'i' } },
      { mobile: { $regex: safe } },
      { membership_id: { $regex: safe, $options: 'i' } },
      { epic_no: { $regex: safe, $options: 'i' } },
      { 'voter.name': { $regex: safe, $options: 'i' } },
    ]
  }
  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))
  const skip = (pageNum - 1) * size
  const [rows, total] = await Promise.all([
    coll.find(q, { projection: { _id: 0 } }).sort({ submitted_at: -1 }).skip(skip).limit(size).toArray(),
    coll.countDocuments(q),
  ])
  return { applications: rows, total, page: pageNum, pageSize: size }
}

// Filtered report query for the admin Reports page.
// Filters: bodyType (rural|urban), position (matches any preference),
// from/to (submitted_at date range, inclusive), search (id/name/mobile/etc).
export async function getReport({ bodyType, position, from, to, search, page = 1, pageSize = 20 } = {}) {
  const db = getAppDb()
  const coll = db.collection(COLLECTION)
  const q = {}

  if (bodyType === 'rural' || bodyType === 'urban') q.body_type = bodyType
  if (position && String(position).trim()) q.position_preferences = String(position).trim()

  const range = {}
  if (from) { const d = new Date(from); if (!Number.isNaN(d.getTime())) range.$gte = d }
  if (to) { const d = new Date(to); if (!Number.isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); range.$lte = d } }
  if (Object.keys(range).length) q.submitted_at = range

  const term = String(search || '').trim()
  if (term) {
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    q.$or = [
      { application_id: { $regex: safe, $options: 'i' } },
      { mobile: { $regex: safe } },
      { membership_id: { $regex: safe, $options: 'i' } },
      { epic_no: { $regex: safe, $options: 'i' } },
      { 'voter.name': { $regex: safe, $options: 'i' } },
    ]
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  // Allow large page sizes so CSV export can fetch the full filtered set.
  const size = Math.min(5000, Math.max(1, parseInt(pageSize, 10) || 20))
  const skip = (pageNum - 1) * size
  const [rows, total] = await Promise.all([
    coll.find(q, { projection: { _id: 0 } }).sort({ submitted_at: -1 }).skip(skip).limit(size).toArray(),
    coll.countDocuments(q),
  ])
  return { applications: rows, total, page: pageNum, pageSize: size }
}

// Aggregate counts for the admin dashboard.
export async function getStats() {
  const db = getAppDb()
  const coll = db.collection(COLLECTION)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const [total, rural, urban, today] = await Promise.all([
    coll.countDocuments({}),
    coll.countDocuments({ body_type: 'rural' }),
    coll.countDocuments({ body_type: 'urban' }),
    coll.countDocuments({ submitted_at: { $gte: startOfToday } }),
  ])
  return { total, rural, urban, today }
}

// Top-N assemblies by number of submitted applications.
export async function getTopAssemblies(limit = 10) {
  const db = getAppDb()
  const coll = db.collection(COLLECTION)
  const rows = await coll.aggregate([
    { $match: { 'voter.assembly_no': { $ne: null } } },
    { $group: {
      _id: '$voter.assembly_no',
      name: { $first: '$voter.assembly_name' },
      count: { $sum: 1 },
    } },
    { $sort: { count: -1 } },
    { $limit: Math.max(1, Math.min(50, parseInt(limit, 10) || 10)) },
  ]).toArray()
  return rows.map((r) => ({
    assembly_no: r._id,
    assembly_name: r.name || '',
    count: r.count,
  }))
}

// Latest application for a given mobile number (used to detect repeat applicants).
export async function findLatestApplicationByMobile(mobile) {
  const db = getAppDb()
  const m = String(mobile || '').replace(/\D/g, '').slice(-10)
  if (!/^\d{10}$/.test(m)) return null
  return db.collection(COLLECTION).findOne(
    { mobile: m },
    { projection: { _id: 0 }, sort: { submitted_at: -1 } }
  )
}
