import { db } from './db'

export async function addMatch({ playedAt, rows, source = 'manual' }) {
  return db.transaction('rw', db.matches, db.matchEntries, async () => {
    const matchId = await db.matches.add({
      playedAt,
      createdAt: Date.now(),
      source,
    })

    await db.matchEntries.bulkAdd(
      rows.map((row) => ({ ...row, matchId }))
    )

    return matchId
  })
}

export async function getLatestMatchEntries() {
  const latestMatch = await db.matches.orderBy('playedAt').last()
  if (!latestMatch) return []

  return db.matchEntries.where('matchId').equals(latestMatch.id).toArray()
}

export async function getRosterSummary() {
  const entries = await db.matchEntries.toArray()

  const byUma = new Map()
  for (const entry of entries) {
    const stats = byUma.get(entry.umaName) ?? { total: 0, count: 0, distance: entry.distance }
    stats.total += entry.points
    stats.count += 1
    stats.distance = entry.distance
    byUma.set(entry.umaName, stats)
  }

  return Array.from(byUma.entries())
    .map(([umaName, { total, count, distance }]) => ({
      umaName,
      distance,
      matchCount: count,
      average: total / count,
    }))
    .sort((a, b) => a.average - b.average)
}

export async function deleteUmaHistory(umaName) {
  return db.matchEntries.where('umaName').equals(umaName).delete()
}
