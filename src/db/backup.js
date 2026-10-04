import { db } from './db'
import { validateRoster } from './roster'

export const BACKUP_FORMAT = 'uma-team-trials-backup'
export const BACKUP_VERSION = 1

// The whole database as raw rows, ids included, so `rosterId`/`matchId`
// links and deleted-score snapshots survive a round trip.
export async function exportBackup() {
  return db.transaction('r', db.roster, db.matches, db.matchEntries, async () => ({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    roster: await db.roster.toArray(),
    matches: await db.matches.toArray(),
    matchEntries: await db.matchEntries.toArray(),
  }))
}

export function backupFileName(date) {
  const pad = (n) => String(n).padStart(2, '0')
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `uma-team-trials-backup-${day}.json`
}

export function parseBackupText(text) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error("This file isn't a valid backup file (it isn't JSON).")
  }
}

function isId(value) {
  return Number.isInteger(value) && value > 0
}

function isObject(value) {
  return typeof value === 'object' && value !== null
}

// Every row needs its own positive integer id, unique within its table.
function checkIds(rows, label, errors) {
  const seen = new Set()
  rows.forEach((row, index) => {
    if (!isId(row.id)) errors.push(`${label} ${index + 1}: missing or invalid id.`)
    else if (seen.has(row.id)) errors.push(`${label} ${index + 1}: id ${row.id} is used more than once.`)
    else seen.add(row.id)
  })
  return seen
}

// Problems that stop a backup from being imported, as messages. The first
// failed structural check returns early, since later checks depend on it.
export function validateBackup(data) {
  if (!isObject(data) || data.format !== BACKUP_FORMAT) {
    return ["This file isn't an Uma Team Trials Score Auditor backup."]
  }
  if (data.version !== BACKUP_VERSION) {
    return [`This backup's version (${data.version}) isn't supported.`]
  }
  const tables = ['roster', 'matches', 'matchEntries']
  if (!tables.every((table) => Array.isArray(data[table]) && data[table].every(isObject))) {
    return ['This backup is damaged: its roster, matches, or scores are missing.']
  }

  const errors = []

  const rosterIds = checkIds(data.roster, 'Roster slot', errors)
  if (data.roster.every((slot) => typeof slot.umaName === 'string')) {
    errors.push(...validateRoster(data.roster))
  } else {
    errors.push('Every roster slot needs an uma name.')
  }

  const matchIds = checkIds(data.matches, 'Match', errors)
  data.matches.forEach((match, index) => {
    if (typeof match.playedAt !== 'string') errors.push(`Match ${index + 1}: missing its date.`)
  })

  checkIds(data.matchEntries, 'Score', errors)
  data.matchEntries.forEach((entry, index) => {
    const label = `Score ${index + 1}`
    if (!matchIds.has(entry.matchId)) errors.push(`${label}: belongs to a match that isn't in the backup.`)
    if (!rosterIds.has(entry.rosterId)) errors.push(`${label}: belongs to a roster slot that isn't in the backup.`)
    if (!Number.isFinite(entry.points)) errors.push(`${label}: points must be a number.`)
    if (
      entry.deleted !== undefined &&
      !(isObject(entry.deleted) && typeof entry.deleted.umaName === 'string' && typeof entry.deleted.distance === 'string')
    ) {
      errors.push(`${label}: its deleted-uma record is damaged.`)
    }
  })

  return errors
}

// Replaces everything in the app with the backup, all or nothing. Only known
// fields are copied, so stray keys in an edited file don't end up stored.
export async function importBackup(data) {
  const errors = validateBackup(data)
  if (errors.length > 0) throw new Error(errors.join(' '))

  return db.transaction('rw', db.roster, db.matches, db.matchEntries, async () => {
    await db.matchEntries.clear()
    await db.matches.clear()
    await db.roster.clear()

    await db.roster.bulkAdd(
      data.roster.map(({ id, umaName, distance }) => ({ id, umaName: umaName.trim(), distance }))
    )
    await db.matches.bulkAdd(
      data.matches.map(({ id, playedAt, createdAt, source }) => ({ id, playedAt, createdAt, source }))
    )
    await db.matchEntries.bulkAdd(
      data.matchEntries.map(({ id, matchId, rosterId, points, deleted }) => ({
        id,
        matchId,
        rosterId,
        points,
        ...(deleted && { deleted: { umaName: deleted.umaName, distance: deleted.distance } }),
      }))
    )
  })
}
