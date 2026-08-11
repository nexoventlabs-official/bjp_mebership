import { MongoClient } from 'mongodb'

// Two independent connections:
//   voterDb -> voter roll (ass_1..ass_234), READ-ONLY, 5.8cr records
//   appDb   -> BJP local body applications (read/write)
let voterClient, appClient
let voterDb = null
let appDb = null

export async function connectDbs() {
  const {
    MONGO_VOTER_URL, MONGO_VOTER_DB_NAME,
    MONGO_APP_URL, MONGO_APP_DB_NAME,
  } = process.env

  try {
    voterClient = new MongoClient(MONGO_VOTER_URL, { serverSelectionTimeoutMS: 8000 })
    await voterClient.connect()
    voterDb = voterClient.db(MONGO_VOTER_DB_NAME)
    console.log(`[db] voter_db connected (${MONGO_VOTER_DB_NAME}) — read only`)
  } catch (e) {
    console.warn(`[db] voter_db connection failed: ${e.message} (voter lookup will report offline)`)
    voterDb = null
  }

  try {
    appClient = new MongoClient(MONGO_APP_URL, { serverSelectionTimeoutMS: 8000 })
    await appClient.connect()
    appDb = appClient.db(MONGO_APP_DB_NAME)
    // Helpful index for lookups by mobile / application id
    try {
      await appDb.collection('applications').createIndex({ application_id: 1 }, { unique: true })
      await appDb.collection('applications').createIndex({ mobile: 1 })
    } catch (_) { /* index best-effort */ }
    console.log(`[db] app db connected (${MONGO_APP_DB_NAME})`)
  } catch (e) {
    console.warn(`[db] app db connection failed: ${e.message}`)
    appDb = null
  }
}

export function getVoterDb() {
  if (!voterDb) throw new Error('VOTER_DB_OFFLINE')
  return voterDb
}
export function isVoterDbOnline() { return !!voterDb }

export function getAppDb() {
  if (!appDb) throw new Error('APP_DB_OFFLINE')
  return appDb
}
export function isAppDbOnline() { return !!appDb }

export async function closeDbs() {
  await voterClient?.close().catch(() => {})
  await appClient?.close().catch(() => {})
}
