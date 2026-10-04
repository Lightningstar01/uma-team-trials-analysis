import { describe, it, expect, beforeEach } from 'vitest'
import {
  addMatches,
  createRosterWithMatches,
  deleteAllMatches,
  deleteMatch,
  deleteOutOfDateMatches,
  deleteUmaScores,
  findWeakestLink,
  getMatchHistory,
  getMatchKeys,
  getRosterStats,
  matchKey,
} from './matches.js'
import { createRoster, updateRosterSlot } from './roster.js'
import { db } from './db.js'
import { DISTANCE_ORDER } from './constants.js'

// 15 slots, 3 per distance: "Uma 1".."Uma 15".
function makeRosterRows() {
  return Array.from({ length: 15 }, (_, i) => ({
    umaName: `Uma ${i + 1}`,
    distance: DISTANCE_ORDER[Math.floor(i / 3)],
  }))
}

// A full match: one entry per slot, Uma 1 scoring 100, Uma 2 200, and so on.
function fullMatchEntries(slotIds) {
  return slotIds.map((rosterId, i) => ({ rosterId, points: (i + 1) * 100 }))
}

beforeEach(async () => {
  await db.matchEntries.clear()
  await db.matches.clear()
  await db.roster.clear()
})

describe('addMatches', () => {
  it('persists each match with its entries linked by matchId', async () => {
    const [a, b] = await createRoster(makeRosterRows())
    const [first, second] = await addMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      matches: [
        { source: 'ocr', entries: [{ rosterId: a, points: 100 }, { rosterId: b, points: 200 }] },
        { entries: [{ rosterId: a, points: 300 }] },
      ],
    })

    expect(await db.matches.get(first)).toMatchObject({
      playedAt: '2026-01-01T00:00:00.000Z',
      source: 'ocr',
    })
    expect(await db.matches.get(second)).toMatchObject({ source: 'manual' })
    expect(typeof (await db.matches.get(first)).createdAt).toBe('number')

    const entries = await db.matchEntries.where('matchId').equals(first).toArray()
    expect(entries.map(({ rosterId, points }) => ({ rosterId, points }))).toEqual([
      { rosterId: a, points: 100 },
      { rosterId: b, points: 200 },
    ])
  })
})

describe('createRosterWithMatches', () => {
  it('creates the roster and links each match row to its slot by name', async () => {
    const roster = makeRosterRows()
    await createRosterWithMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      roster,
      matches: [{ source: 'ocr', rows: [{ umaName: 'uma 2', points: 500 }] }],
    })

    const slot = (await db.roster.toArray()).find((s) => s.umaName === 'Uma 2')
    const [entry] = await db.matchEntries.toArray()
    expect(entry).toMatchObject({ rosterId: slot.id, points: 500 })
  })

  it('stores nothing when a match row names an uma not on the roster', async () => {
    await expect(
      createRosterWithMatches({
        playedAt: '2026-01-01T00:00:00.000Z',
        roster: makeRosterRows(),
        matches: [{ source: 'ocr', rows: [{ umaName: 'Stranger', points: 500 }] }],
      })
    ).rejects.toThrow("Stranger isn't on the roster.")

    expect(await db.roster.count()).toBe(0)
    expect(await db.matches.count()).toBe(0)
  })
})

describe('getRosterStats', () => {
  it('returns every slot with null stats when nothing is logged', async () => {
    await createRoster(makeRosterRows())
    const stats = await getRosterStats()
    expect(stats).toHaveLength(15)
    expect(stats[0]).toMatchObject({ matchCount: 0, average: null, high: null, low: null, scores: [] })
  })

  it('computes average, high, low, and newest-first scores per slot', async () => {
    const [a, b] = await createRoster(makeRosterRows())
    const [older] = await addMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      matches: [{ entries: [{ rosterId: a, points: 100 }, { rosterId: b, points: 999 }] }],
    })
    const [newer] = await addMatches({
      playedAt: '2026-01-03T00:00:00.000Z',
      matches: [{ entries: [{ rosterId: a, points: 210 }] }],
    })
    const [middle] = await addMatches({
      playedAt: '2026-01-02T00:00:00.000Z',
      matches: [{ entries: [{ rosterId: a, points: 200 }] }],
    })

    const slotA = (await getRosterStats()).find((s) => s.id === a)
    expect(slotA.matchCount).toBe(3)
    expect(slotA.average).toBeCloseTo(170, 5)
    expect(slotA.high).toBe(210)
    expect(slotA.low).toBe(100)
    expect(slotA.scores.map((s) => s.matchId)).toEqual([newer, middle, older])
    expect(slotA.scores[0]).toEqual({ matchId: newer, playedAt: '2026-01-03T00:00:00.000Z', points: 210 })
  })

  it('leaves out deleted scores', async () => {
    const [a, b] = await createRoster(makeRosterRows())
    await addMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      matches: [{ entries: [{ rosterId: a, points: 100 }, { rosterId: b, points: 200 }] }],
    })
    await deleteUmaScores(a)

    const stats = await getRosterStats()
    expect(stats.find((s) => s.id === a)).toMatchObject({ matchCount: 0, average: null, scores: [] })
    expect(stats.find((s) => s.id === b)).toMatchObject({ matchCount: 1, average: 200 })
  })
})

describe('findWeakestLink', () => {
  it('returns the id with the lowest average, ignoring unscored slots', () => {
    const stats = [
      { id: 1, average: 50000 },
      { id: 2, average: null },
      { id: 3, average: 30000 },
    ]
    expect(findWeakestLink(stats)).toBe(3)
  })

  it('returns null when nothing is scored', () => {
    expect(findWeakestLink([{ id: 1, average: null }])).toBeNull()
  })
})

describe('getMatchHistory', () => {
  it('lists matches newest first', async () => {
    const ids = await createRoster(makeRosterRows())
    const [older] = await addMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      matches: [{ entries: fullMatchEntries(ids) }],
    })
    const [newer] = await addMatches({
      playedAt: '2026-01-02T00:00:00.000Z',
      matches: [{ source: 'ocr', entries: fullMatchEntries(ids) }],
    })

    expect(await getMatchHistory()).toMatchObject([
      { matchId: newer, playedAt: '2026-01-02T00:00:00.000Z', source: 'ocr', deletedCount: 0, missingCount: 0 },
      { matchId: older, playedAt: '2026-01-01T00:00:00.000Z', source: 'manual', deletedCount: 0, missingCount: 0 },
    ])
  })

  it("shows each entry's current name and distance, highest points first", async () => {
    const ids = await createRoster(makeRosterRows())
    await addMatches({ playedAt: '2026-01-01T00:00:00.000Z', matches: [{ entries: fullMatchEntries(ids) }] })

    const [match] = await getMatchHistory()
    expect(match.entries).toHaveLength(15)
    expect(match.entries[0]).toMatchObject({ umaName: 'Uma 15', distance: 'Dirt', points: 1500, deleted: false })
    expect(match.entries[14]).toMatchObject({ umaName: 'Uma 1', distance: 'Sprint', points: 100, deleted: false })
  })

  it("keeps a deleted uma's snapshot after its slot is edited, and counts it as deleted", async () => {
    const ids = await createRoster(makeRosterRows())
    await addMatches({ playedAt: '2026-01-01T00:00:00.000Z', matches: [{ entries: fullMatchEntries(ids) }] })
    await deleteUmaScores(ids[0])
    await updateRosterSlot(ids[0], { umaName: 'New Uma', distance: 'Long' })

    const [match] = await getMatchHistory()
    expect(match.deletedCount).toBe(1)
    expect(match.missingCount).toBe(0)
    expect(match.entries.find((e) => e.points === 100)).toMatchObject({
      umaName: 'Uma 1',
      distance: 'Sprint',
      deleted: true,
    })
  })

  it('counts entries missing from a match as deleted', async () => {
    const ids = await createRoster(makeRosterRows())
    await addMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      matches: [{ entries: fullMatchEntries(ids).slice(1) }],
    })

    const [match] = await getMatchHistory()
    expect(match).toMatchObject({ missingCount: 1, deletedCount: 1 })
  })

  it('breaks a playedAt tie by newest match id first', async () => {
    const [a] = await createRoster(makeRosterRows())
    const [first, second] = await addMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      matches: [{ entries: [{ rosterId: a, points: 1 }] }, { entries: [{ rosterId: a, points: 2 }] }],
    })
    expect((await getMatchHistory()).map((m) => m.matchId)).toEqual([second, first])
  })
})

describe('matchKey', () => {
  it('ignores entry order', () => {
    const a = [{ rosterId: 1, points: 100 }, { rosterId: 2, points: 200 }]
    expect(matchKey(a)).toBe(matchKey([...a].reverse()))
  })

  it('differs when any slot has different points', () => {
    expect(matchKey([{ rosterId: 1, points: 100 }, { rosterId: 2, points: 200 }])).not.toBe(
      matchKey([{ rosterId: 1, points: 100 }, { rosterId: 2, points: 201 }])
    )
  })

  it('differs when the same points belong to different slots', () => {
    expect(matchKey([{ rosterId: 1, points: 100 }, { rosterId: 2, points: 200 }])).not.toBe(
      matchKey([{ rosterId: 1, points: 200 }, { rosterId: 2, points: 100 }])
    )
  })
})

describe('getMatchKeys', () => {
  it("maps each logged match's key to its playedAt", async () => {
    const [a, b] = await createRoster(makeRosterRows())
    const first = [{ rosterId: a, points: 100 }, { rosterId: b, points: 200 }]
    const second = [{ rosterId: a, points: 300 }, { rosterId: b, points: 400 }]
    await addMatches({ playedAt: '2026-01-01T00:00:00.000Z', matches: [{ entries: first }] })
    await addMatches({ playedAt: '2026-01-02T00:00:00.000Z', matches: [{ entries: second }] })

    expect(await getMatchKeys()).toEqual(
      new Map([
        [matchKey(first), '2026-01-01T00:00:00.000Z'],
        [matchKey(second), '2026-01-02T00:00:00.000Z'],
      ])
    )
  })

  it('does not treat a match with some scores deleted as identical to the full match', async () => {
    const [a, b] = await createRoster(makeRosterRows())
    const full = [{ rosterId: a, points: 100 }, { rosterId: b, points: 200 }]
    await addMatches({ playedAt: '2026-01-01T00:00:00.000Z', matches: [{ entries: full }] })
    await deleteUmaScores(b)

    expect((await getMatchKeys()).has(matchKey(full))).toBe(false)
  })

  it('returns an empty map when nothing is logged', async () => {
    expect(await getMatchKeys()).toEqual(new Map())
  })
})

describe('deleteMatch', () => {
  it('removes the match and only its entries', async () => {
    const [a] = await createRoster(makeRosterRows())
    const [keep, remove] = await addMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      matches: [{ entries: [{ rosterId: a, points: 1 }] }, { entries: [{ rosterId: a, points: 2 }] }],
    })

    await deleteMatch(remove)

    expect(await db.matches.get(remove)).toBeUndefined()
    expect(await db.matches.get(keep)).toBeDefined()
    expect((await db.matchEntries.toArray()).map((e) => e.points)).toEqual([1])
  })
})

describe('deleteAllMatches', () => {
  it('removes every match and score but keeps the roster', async () => {
    const ids = await createRoster(makeRosterRows())
    await addMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      matches: [{ entries: fullMatchEntries(ids) }, { entries: fullMatchEntries(ids) }],
    })

    await deleteAllMatches()

    expect(await db.matches.count()).toBe(0)
    expect(await db.matchEntries.count()).toBe(0)
    expect(await db.roster.get(ids[0])).toMatchObject({ umaName: 'Uma 1', distance: 'Sprint' })
    expect(await db.roster.count()).toBe(15)
  })
})

describe('deleteOutOfDateMatches', () => {
  it('deletes matches with a deleted or missing uma, and keeps up-to-date ones', async () => {
    const ids = await createRoster(makeRosterRows())
    const [withDeleted, upToDate, withMissing] = await addMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      matches: [
        { entries: fullMatchEntries(ids) },
        { entries: fullMatchEntries(ids) },
        { entries: fullMatchEntries(ids).slice(1) },
      ],
    })
    // Marks Uma 1 deleted in the first match only, so the second stays up to date.
    await db.matchEntries
      .where('matchId')
      .equals(withDeleted)
      .filter((e) => e.rosterId === ids[0])
      .modify({ deleted: { umaName: 'Uma 1', distance: 'Sprint' } })

    expect(await deleteOutOfDateMatches()).toBe(2)

    expect((await db.matches.toArray()).map((m) => m.id)).toEqual([upToDate])
    expect(await db.matchEntries.where('matchId').anyOf([withDeleted, withMissing]).count()).toBe(0)
    expect(await db.matchEntries.where('matchId').equals(upToDate).count()).toBe(15)
  })

  it('resolves to 0 when every match is up to date', async () => {
    const ids = await createRoster(makeRosterRows())
    await addMatches({ playedAt: '2026-01-01T00:00:00.000Z', matches: [{ entries: fullMatchEntries(ids) }] })

    expect(await deleteOutOfDateMatches()).toBe(0)
    expect(await db.matches.count()).toBe(1)
  })
})

describe('deleteUmaScores', () => {
  it("marks only that slot's entries deleted with a snapshot, keeping the slot and match", async () => {
    const [a, b] = await createRoster(makeRosterRows())
    const [matchId] = await addMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      matches: [{ entries: [{ rosterId: a, points: 1 }, { rosterId: b, points: 2 }] }],
    })

    expect(await deleteUmaScores(a)).toBe(1)

    expect(await db.roster.get(a)).toBeDefined()
    expect(await db.matches.get(matchId)).toBeDefined()
    const entries = await db.matchEntries.toArray()
    expect(entries.find((e) => e.rosterId === a).deleted).toEqual({ umaName: 'Uma 1', distance: 'Sprint' })
    expect(entries.find((e) => e.rosterId === b).deleted).toBeUndefined()
  })

  it('does not re-mark entries that are already deleted', async () => {
    const [a, b] = await createRoster(makeRosterRows())
    await addMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      matches: [{ entries: [{ rosterId: a, points: 1 }, { rosterId: b, points: 2 }] }],
    })
    await deleteUmaScores(a)
    await updateRosterSlot(a, { umaName: 'New Uma', distance: 'Long' })

    expect(await deleteUmaScores(a)).toBe(0)
    const entry = (await db.matchEntries.toArray()).find((e) => e.rosterId === a)
    expect(entry.deleted).toEqual({ umaName: 'Uma 1', distance: 'Sprint' })
  })

  it('removes a match, and all of its entries, once it has no active entries left', async () => {
    const [a, b] = await createRoster(makeRosterRows())
    const [onlyA, both] = await addMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      matches: [
        { entries: [{ rosterId: a, points: 1 }] },
        { entries: [{ rosterId: a, points: 2 }, { rosterId: b, points: 3 }] },
      ],
    })

    expect(await deleteUmaScores(a)).toBe(2)

    expect(await db.matches.get(onlyA)).toBeUndefined()
    expect(await db.matchEntries.where('matchId').equals(onlyA).count()).toBe(0)
    expect(await db.matches.get(both)).toBeDefined()

    await deleteUmaScores(b)
    expect(await db.matches.get(both)).toBeUndefined()
    expect(await db.matchEntries.count()).toBe(0)
  })

  it('resolves to 0 when the slot has no scores', async () => {
    const [a] = await createRoster(makeRosterRows())
    expect(await deleteUmaScores(a)).toBe(0)
  })
})
