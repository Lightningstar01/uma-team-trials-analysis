import { db, isActive } from './db'
import { ROSTER_SIZE } from './constants'
import { createRoster, getRoster } from './roster'

function normalizeName(name) {
  return name.trim().toLowerCase()
}

// `matches`: [{ source, entries: [{ rosterId, points }] }]. All matches in
// one call share `playedAt` (one batch upload). Resolves to the new match ids.
export async function addMatches({ playedAt, matches }) {
  return db.transaction('rw', db.matches, db.matchEntries, async () => {
    const matchIds = []
    for (const { source = 'manual', entries } of matches) {
      const matchId = await db.matches.add({ playedAt, createdAt: Date.now(), source })
      await db.matchEntries.bulkAdd(
        entries.map(({ rosterId, points }) => ({ matchId, rosterId, points }))
      )
      matchIds.push(matchId)
    }
    return matchIds
  })
}

// Auto-fill path: creates the roster and the batch's matches together, so a
// failure leaves neither behind. `matches` rows reference umas by name
// (`[{ source, rows: [{ umaName, points }] }]`), since the slots don't have
// ids yet.
export async function createRosterWithMatches({ playedAt, roster, matches }) {
  return db.transaction('rw', db.roster, db.matches, db.matchEntries, async () => {
    const slotIds = await createRoster(roster)
    const idByName = new Map(roster.map((slot, i) => [normalizeName(slot.umaName), slotIds[i]]))

    return addMatches({
      playedAt,
      matches: matches.map(({ source, rows }) => ({
        source,
        entries: rows.map((row) => {
          const rosterId = idByName.get(normalizeName(row.umaName))
          if (rosterId === undefined) throw new Error(`${row.umaName} isn't on the roster.`)
          return { rosterId, points: row.points }
        }),
      })),
    })
  })
}

function newestFirst(a, b) {
  return b.playedAt.localeCompare(a.playedAt) || b.matchId - a.matchId
}

function groupByMatch(entries) {
  const entriesByMatch = new Map()
  for (const entry of entries) {
    const matchEntries = entriesByMatch.get(entry.matchId) ?? []
    matchEntries.push(entry)
    entriesByMatch.set(entry.matchId, matchEntries)
  }
  return entriesByMatch
}

// One item per roster slot (roster order), with that slot's scores newest
// first. Stats are null for a slot with no scores yet. Deleted entries
// don't count.
export async function getRosterStats() {
  const [roster, matches, entries] = await Promise.all([
    getRoster(),
    db.matches.toArray(),
    db.matchEntries.toArray(),
  ])

  const playedAtByMatch = new Map(matches.map((match) => [match.id, match.playedAt]))
  const scoresBySlot = new Map()
  for (const entry of entries.filter(isActive)) {
    const scores = scoresBySlot.get(entry.rosterId) ?? []
    scores.push({
      matchId: entry.matchId,
      playedAt: playedAtByMatch.get(entry.matchId),
      points: entry.points,
    })
    scoresBySlot.set(entry.rosterId, scores)
  }

  return roster.map((slot) => {
    const scores = (scoresBySlot.get(slot.id) ?? []).sort(newestFirst)
    const points = scores.map((score) => score.points)
    const hasScores = points.length > 0
    return {
      ...slot,
      scores,
      matchCount: points.length,
      average: hasScores ? points.reduce((sum, p) => sum + p, 0) / points.length : null,
      high: hasScores ? Math.max(...points) : null,
      low: hasScores ? Math.min(...points) : null,
    }
  })
}

// Simple Mode weakest link: the slot with the lowest raw average, among
// slots that have at least one score. Null when nothing is scored yet.
export function findWeakestLink(stats) {
  let weakest = null
  for (const slot of stats) {
    if (slot.average === null) continue
    if (weakest === null || slot.average < weakest.average) weakest = slot
  }
  return weakest?.id ?? null
}

// Every logged match, newest first, with its entries highest points first.
// An active entry shows its slot's current name and distance; a deleted one
// shows the snapshot taken when it was deleted. `missingCount` counts
// entries hard-deleted before deletes kept a snapshot (no details left).
// A match with any deleted or missing uma is out of date with the roster.
export async function getMatchHistory() {
  const [roster, matches, entries] = await Promise.all([
    db.roster.toArray(),
    db.matches.toArray(),
    db.matchEntries.toArray(),
  ])

  const slotById = new Map(roster.map((slot) => [slot.id, slot]))
  const entriesByMatch = groupByMatch(entries)

  return matches
    .map((match) => {
      const matchEntries = (entriesByMatch.get(match.id) ?? [])
        .map((entry) => {
          const { umaName, distance } = entry.deleted ?? slotById.get(entry.rosterId)
          return { entryId: entry.id, umaName, distance, points: entry.points, deleted: !isActive(entry) }
        })
        .sort((a, b) => b.points - a.points)
      const missingCount = Math.max(0, ROSTER_SIZE - matchEntries.length)

      return {
        matchId: match.id,
        playedAt: match.playedAt,
        source: match.source,
        entries: matchEntries,
        missingCount,
        deletedCount: matchEntries.filter((entry) => entry.deleted).length + missingCount,
      }
    })
    .sort(newestFirst)
}

// A match's identity for duplicate detection: its slot/points pairs, in any
// order. The date isn't part of it, since a batch's date is typed in by hand.
export function matchKey(entries) {
  return entries
    .map(({ rosterId, points }) => `${rosterId}:${points}`)
    .sort()
    .join(',')
}

// Every logged match's matchKey (active entries only), mapped to that
// match's playedAt, so a new match can be checked against history before
// saving.
export async function getMatchKeys() {
  const [matches, entries] = await Promise.all([
    db.matches.toArray(),
    db.matchEntries.toArray(),
  ])

  const entriesByMatch = groupByMatch(entries.filter(isActive))
  const keys = new Map()
  for (const match of matches) {
    const key = matchKey(entriesByMatch.get(match.id) ?? [])
    if (!keys.has(key)) keys.set(key, match.playedAt)
  }
  return keys
}

// Same rule as getMatchHistory's deletedCount > 0.
function isOutOfDate(matchEntries) {
  return matchEntries.length < ROSTER_SIZE || !matchEntries.every(isActive)
}

// Deletes every match that's out of date with the roster (any deleted or
// missing uma). Resolves to the number of matches deleted.
export async function deleteOutOfDateMatches() {
  return db.transaction('rw', db.matches, db.matchEntries, async () => {
    const [matches, entries] = await Promise.all([db.matches.toArray(), db.matchEntries.toArray()])
    const entriesByMatch = groupByMatch(entries)
    const matchIds = matches
      .filter((match) => isOutOfDate(entriesByMatch.get(match.id) ?? []))
      .map((match) => match.id)

    await db.matchEntries.where('matchId').anyOf(matchIds).delete()
    await db.matches.bulkDelete(matchIds)
    return matchIds.length
  })
}

// Deletes every match and score but keeps the roster's umas and distances.
export async function deleteAllMatches() {
  return db.transaction('rw', db.matches, db.matchEntries, async () => {
    await db.matchEntries.clear()
    await db.matches.clear()
  })
}

export async function deleteMatch(matchId) {
  return db.transaction('rw', db.matches, db.matchEntries, async () => {
    await db.matchEntries.where('matchId').equals(matchId).delete()
    await db.matches.delete(matchId)
  })
}

// Deletes one slot's scores (the slot itself stays). The entries are marked
// deleted with a snapshot of the slot, so their matches can still show them
// struck through after the slot is edited. A match left with no active
// scores is removed entirely, so it doesn't linger as an all-deleted row in
// the match history. Resolves to the number of scores deleted.
export async function deleteUmaScores(rosterId) {
  return db.transaction('rw', db.roster, db.matches, db.matchEntries, async () => {
    const activeEntries = () => db.matchEntries.where('rosterId').equals(rosterId).filter(isActive)
    const entries = await activeEntries().toArray()
    if (entries.length === 0) return 0

    const { umaName, distance } = await db.roster.get(rosterId)
    await activeEntries().modify({ deleted: { umaName, distance } })

    for (const matchId of new Set(entries.map((entry) => entry.matchId))) {
      const remaining = await db.matchEntries.where('matchId').equals(matchId).filter(isActive).count()
      if (remaining === 0) await deleteMatch(matchId)
    }

    return entries.length
  })
}
