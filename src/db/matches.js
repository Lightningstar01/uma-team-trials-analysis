import { db } from './db'
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

// One item per roster slot (roster order), with that slot's scores newest
// first. Stats are null for a slot with no scores yet.
export async function getRosterStats() {
  const [roster, matches, entries] = await Promise.all([
    getRoster(),
    db.matches.toArray(),
    db.matchEntries.toArray(),
  ])

  const playedAtByMatch = new Map(matches.map((match) => [match.id, match.playedAt]))
  const scoresBySlot = new Map()
  for (const entry of entries) {
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

export async function getMatchHistory() {
  const [matches, entries] = await Promise.all([
    db.matches.toArray(),
    db.matchEntries.toArray(),
  ])

  const countByMatch = new Map()
  for (const entry of entries) {
    countByMatch.set(entry.matchId, (countByMatch.get(entry.matchId) ?? 0) + 1)
  }

  return matches
    .map((match) => ({
      matchId: match.id,
      playedAt: match.playedAt,
      source: match.source,
      entryCount: countByMatch.get(match.id) ?? 0,
    }))
    .sort(newestFirst)
}

export async function deleteMatch(matchId) {
  return db.transaction('rw', db.matches, db.matchEntries, async () => {
    await db.matchEntries.where('matchId').equals(matchId).delete()
    await db.matches.delete(matchId)
  })
}

// Deletes one slot's scores (the slot itself stays). A match left with no
// scores at all is removed too, so it doesn't linger as an empty row in
// the match history. Resolves to the number of scores deleted.
export async function deleteUmaScores(rosterId) {
  return db.transaction('rw', db.matches, db.matchEntries, async () => {
    const entries = await db.matchEntries.where('rosterId').equals(rosterId).toArray()
    await db.matchEntries.bulkDelete(entries.map((entry) => entry.id))

    for (const matchId of new Set(entries.map((entry) => entry.matchId))) {
      const remaining = await db.matchEntries.where('matchId').equals(matchId).count()
      if (remaining === 0) await db.matches.delete(matchId)
    }

    return entries.length
  })
}
