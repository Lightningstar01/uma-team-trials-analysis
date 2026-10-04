import { db, isActive } from './db'
import { DISTANCES, DISTANCE_ORDER, ROSTER_SIZE } from './constants'

function normalizeName(name) {
  return name.trim().toLowerCase()
}

export function sortRoster(slots) {
  return [...slots].sort((a, b) => {
    const distanceDiff = DISTANCE_ORDER.indexOf(a.distance) - DISTANCE_ORDER.indexOf(b.distance)
    if (distanceDiff !== 0) return distanceDiff
    return a.umaName.localeCompare(b.umaName)
  })
}

export async function getRoster() {
  return sortRoster(await db.roster.toArray())
}

// Blocking problems only - a roster with any of these can't be saved.
// Softer checks (unrecognized name, distance category not exactly 3 umas)
// are warnings from validateRows in src/ocr/parseScoreInfo.js instead.
export function validateRoster(rows) {
  const errors = []

  if (rows.length !== ROSTER_SIZE) {
    errors.push(`The roster needs exactly ${ROSTER_SIZE} umas (found ${rows.length}).`)
  }

  const seen = new Set()
  rows.forEach((row, index) => {
    const name = row.umaName.trim()
    if (name === '') {
      errors.push(`Row ${index + 1}: uma name is required.`)
    } else if (seen.has(normalizeName(name))) {
      errors.push(`${name} appears more than once — each uma must be unique.`)
    } else {
      seen.add(normalizeName(name))
    }

    if (!DISTANCES.has(row.distance)) {
      errors.push(`Row ${index + 1}: "${row.distance}" is not a distance category.`)
    }
  })

  return errors
}

// Resolves to the new slot ids, in the same order as `rows`.
export async function createRoster(rows) {
  const errors = validateRoster(rows)
  if (errors.length > 0) throw new Error(errors.join(' '))

  return db.transaction('rw', db.roster, async () => {
    if ((await db.roster.count()) > 0) throw new Error('A roster already exists.')
    return db.roster.bulkAdd(
      rows.map((row) => ({ umaName: row.umaName.trim(), distance: row.distance })),
      { allKeys: true }
    )
  })
}

// Start from scratch: removes the roster and every logged match, which
// sends the app back to the roster setup screen.
export async function resetRoster() {
  return db.transaction('rw', db.roster, db.matches, db.matchEntries, async () => {
    await db.matchEntries.clear()
    await db.matches.clear()
    await db.roster.clear()
  })
}

// A slot can only be renamed or moved to another distance once its scores
// are deleted, so a slot's active history always belongs to the name and
// distance it shows (deleted entries carry their own snapshot). Swapping two umas' distances means deleting both first.
export async function updateRosterSlot(id, { umaName, distance }) {
  const name = umaName.trim()
  if (name === '') throw new Error('Uma name is required.')
  if (!DISTANCES.has(distance)) throw new Error(`"${distance}" is not a distance category.`)

  return db.transaction('rw', db.roster, db.matchEntries, async () => {
    const scoreCount = await db.matchEntries.where('rosterId').equals(id).filter(isActive).count()
    if (scoreCount > 0) throw new Error("Delete this uma's scores before editing it.")

    const slots = await db.roster.toArray()
    const duplicate = slots.some(
      (slot) => slot.id !== id && normalizeName(slot.umaName) === normalizeName(name)
    )
    if (duplicate) throw new Error(`${name} is already on the roster.`)

    const updated = await db.roster.update(id, { umaName: name, distance })
    if (updated === 0 && !slots.some((slot) => slot.id === id)) {
      throw new Error('Roster slot not found.')
    }
  })
}
