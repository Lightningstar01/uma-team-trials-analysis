import { describe, it, expect, beforeEach } from 'vitest'
import { addMatch, getLatestMatchEntries, getRosterSummary, deleteUmaHistory } from './matches.js'
import { db } from './db.js'

beforeEach(async () => {
  await db.matchEntries.clear()
  await db.matches.clear()
})

describe('addMatch', () => {
  it('persists a match row and its entries linked by matchId', async () => {
    const rows = [
      { umaName: 'Special Week', distance: 'Medium', points: 80936 },
      { umaName: 'Silence Suzuka', distance: 'Mile', points: 75000 },
    ]
    const matchId = await addMatch({ playedAt: '2026-01-01T00:00:00.000Z', rows })

    const match = await db.matches.get(matchId)
    expect(match.playedAt).toBe('2026-01-01T00:00:00.000Z')

    const entries = await db.matchEntries.where('matchId').equals(matchId).toArray()
    expect(entries).toHaveLength(2)
    expect(entries.map((e) => e.umaName).sort()).toEqual(['Silence Suzuka', 'Special Week'])
  })

  it('defaults source to "manual" when omitted', async () => {
    const matchId = await addMatch({ playedAt: '2026-01-01T00:00:00.000Z', rows: [] })
    const match = await db.matches.get(matchId)
    expect(match.source).toBe('manual')
  })

  it('respects an explicit source', async () => {
    const matchId = await addMatch({ playedAt: '2026-01-01T00:00:00.000Z', rows: [], source: 'ocr' })
    const match = await db.matches.get(matchId)
    expect(match.source).toBe('ocr')
  })

  it('sets a numeric createdAt', async () => {
    const matchId = await addMatch({ playedAt: '2026-01-01T00:00:00.000Z', rows: [] })
    const match = await db.matches.get(matchId)
    expect(typeof match.createdAt).toBe('number')
  })
})

describe('getLatestMatchEntries', () => {
  it('returns an empty array when there are no matches', async () => {
    expect(await getLatestMatchEntries()).toEqual([])
  })

  it('returns the entries for the only match', async () => {
    const rows = [{ umaName: 'Special Week', distance: 'Medium', points: 80936 }]
    await addMatch({ playedAt: '2026-01-01T00:00:00.000Z', rows })

    const entries = await getLatestMatchEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ umaName: 'Special Week', distance: 'Medium', points: 80936 })
  })

  it('returns entries for the match with the greatest playedAt, not the most recently inserted', async () => {
    // Insert the chronologically later match first, and the earlier one second,
    // so a bug that used insertion order instead of playedAt would fail this.
    await addMatch({
      playedAt: '2026-02-01T00:00:00.000Z',
      rows: [{ umaName: 'Newer Match Uma', distance: 'Long', points: 1 }],
    })
    await addMatch({
      playedAt: '2026-01-01T00:00:00.000Z',
      rows: [{ umaName: 'Older Match Uma', distance: 'Long', points: 1 }],
    })

    const entries = await getLatestMatchEntries()
    expect(entries.map((e) => e.umaName)).toEqual(['Newer Match Uma'])
  })
})

describe('getRosterSummary', () => {
  it('returns an empty array when there are no matches', async () => {
    expect(await getRosterSummary()).toEqual([])
  })

  it('summarizes a single match with a single uma', async () => {
    await addMatch({
      playedAt: '2026-01-01T00:00:00.000Z',
      rows: [{ umaName: 'Special Week', distance: 'Medium', points: 80936 }],
    })

    const summary = await getRosterSummary()
    expect(summary).toEqual([
      { umaName: 'Special Week', distance: 'Medium', matchCount: 1, average: 80936 },
    ])
  })

  it('averages points across multiple matches for the same uma', async () => {
    await addMatch({
      playedAt: '2026-01-01T00:00:00.000Z',
      rows: [{ umaName: 'Special Week', distance: 'Medium', points: 100 }],
    })
    await addMatch({
      playedAt: '2026-01-02T00:00:00.000Z',
      rows: [{ umaName: 'Special Week', distance: 'Medium', points: 200 }],
    })
    await addMatch({
      playedAt: '2026-01-03T00:00:00.000Z',
      rows: [{ umaName: 'Special Week', distance: 'Medium', points: 210 }],
    })

    const [summary] = await getRosterSummary()
    expect(summary.matchCount).toBe(3)
    expect(summary.average).toBeCloseTo(170, 5)
  })

  it('sorts ascending by average, weakest link first', async () => {
    await addMatch({
      playedAt: '2026-01-01T00:00:00.000Z',
      rows: [
        { umaName: 'Strong Uma', distance: 'Medium', points: 90000 },
        { umaName: 'Weak Uma', distance: 'Medium', points: 10000 },
        { umaName: 'Middle Uma', distance: 'Medium', points: 50000 },
      ],
    })

    const summary = await getRosterSummary()
    expect(summary.map((s) => s.umaName)).toEqual(['Weak Uma', 'Middle Uma', 'Strong Uma'])
  })

  it('reports the distance from whichever entry was iterated last (current last-write-wins behavior, not a spec)', async () => {
    // getRosterSummary's accumulator unconditionally overwrites `distance` on
    // every entry it sees, so the reported distance is whichever match's
    // entry for this uma was iterated last (insertion order), regardless of
    // playedAt. This test pins down that actual behavior so a future
    // intentional fix changes it on purpose rather than by surprise.
    await addMatch({
      playedAt: '2026-01-01T00:00:00.000Z',
      rows: [{ umaName: 'Special Week', distance: 'Sprint', points: 100 }],
    })
    await addMatch({
      playedAt: '2026-01-02T00:00:00.000Z',
      rows: [{ umaName: 'Special Week', distance: 'Mile', points: 100 }],
    })

    const [summary] = await getRosterSummary()
    expect(summary.distance).toBe('Mile')
  })
})

describe('deleteUmaHistory', () => {
  it('deletes only the target uma\'s entries, leaving other umas and matches intact', async () => {
    const matchId = await addMatch({
      playedAt: '2026-01-01T00:00:00.000Z',
      rows: [
        { umaName: 'Special Week', distance: 'Medium', points: 100 },
        { umaName: 'Silence Suzuka', distance: 'Mile', points: 200 },
      ],
    })

    const deletedCount = await deleteUmaHistory('Special Week')

    expect(deletedCount).toBe(1)
    const remaining = await db.matchEntries.where('matchId').equals(matchId).toArray()
    expect(remaining.map((e) => e.umaName)).toEqual(['Silence Suzuka'])
    expect(await db.matches.get(matchId)).toBeDefined()
  })

  it('deletes a uma\'s entries across multiple matches', async () => {
    await addMatch({
      playedAt: '2026-01-01T00:00:00.000Z',
      rows: [{ umaName: 'Special Week', distance: 'Medium', points: 100 }],
    })
    await addMatch({
      playedAt: '2026-01-02T00:00:00.000Z',
      rows: [{ umaName: 'Special Week', distance: 'Medium', points: 200 }],
    })

    const deletedCount = await deleteUmaHistory('Special Week')

    expect(deletedCount).toBe(2)
    expect(await getRosterSummary()).toEqual([])
  })

  it('resolves to 0 when the uma has no history', async () => {
    expect(await deleteUmaHistory('Nobody')).toBe(0)
  })
})
