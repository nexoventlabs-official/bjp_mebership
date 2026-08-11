import { getVoterDb } from '../config/db.js'

// The voter roll is split across per-assembly collections: ass_1 .. ass_234.
// Voters are looked up by EPIC_NO (uppercase). We scan the ass_* collections
// until a match is found. READ-ONLY — we never write to this DB.

const EPIC_RE = /^[A-Z]{2,4}\d{6,8}$/

export function normalizeEpic(epic) {
  return String(epic || '').trim().toUpperCase()
}

export function isValidEpic(epic) {
  return EPIC_RE.test(normalizeEpic(epic))
}

let _assemblyCollCache = null
let _assemblyCollCacheAt = 0
const COLL_CACHE_TTL = 10 * 60 * 1000 // 10 min

async function assemblyCollections(db) {
  const now = Date.now()
  if (_assemblyCollCache && now - _assemblyCollCacheAt < COLL_CACHE_TTL) {
    return _assemblyCollCache
  }
  const collections = await db.listCollections().toArray()
  const names = collections
    .map((c) => c.name)
    .filter((name) => /^ass_\d+$/.test(name))
    // Lower assembly numbers first (stable, deterministic scan order)
    .sort((a, b) => parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10))
  _assemblyCollCache = names
  _assemblyCollCacheAt = now
  return names
}

// Returns { voter, assembly_no } or null.
export async function findVoterByEpic(epicNo) {
  const db = getVoterDb()
  const clean = normalizeEpic(epicNo)
  if (!clean) return null

  const names = await assemblyCollections(db)
  for (const collName of names) {
    try {
      const voter = await db.collection(collName).findOne({ EPIC_NO: clean })
      if (voter) {
        const acNo = parseInt(collName.slice(4), 10)
        return { voter, assembly_no: acNo }
      }
    } catch { /* skip unreadable collection */ }
  }
  return null
}

// Map a raw voter document to the fields the chatbot displays. Defensive about
// field-name variants across the dataset.
export function toVoterProfile(voter, assemblyNo) {
  if (!voter) return null
  const pick = (...keys) => {
    for (const k of keys) {
      if (voter[k] !== undefined && voter[k] !== null && voter[k] !== '') return voter[k]
    }
    return ''
  }
  return {
    epic_no:      pick('EPIC_NO', 'epic_no'),
    name:         pick('VOTER_NAME_EN', 'VOTER_NAME', 'name', 'voter_name'),
    relation_name: pick('RELATION_NAME_EN', 'RELATION_NAME', 'father_name'),
    age:          pick('AGE', 'age'),
    gender:       pick('GENDER', 'gender'),
    assembly_no:  assemblyNo || pick('ASSEMBLY_NO'),
    assembly_name: pick('ASSEMBLY_NAME', 'ASSEMBLY_NAME_EN', 'assembly_name'),
    district:     pick('DISTRICT', 'DISTRICT_NAME', 'district'),
    part_no:      pick('PART_NO', 'part_no'),
    section_no:   pick('SECTION_NO'),
    serial_no:    pick('SLNO', 'SERIAL_NO', 'serial_no'),
    booth_name:   pick('BOOTH_NAME', 'booth_name'),
  }
}
