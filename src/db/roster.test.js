import { describe, it, expect, beforeEach } from 'vitest'
import {
  createRoster,
  getRoster,
  resetRoster,
  sortRoster,
  updateRosterSlot,
  validateRoster,
} from './roster.js'
import { addMatches, deleteUmaScores } from './matches.js'
import { db } from './db.js'
import { DISTANCE_ORDER } from './constants.js'

// 15 slots, 3 per distance: "Uma 1".."Uma 15".
function makeRosterRows() {
  return Array.from({ length: 15 }, (_, i) => ({
    umaName: `Uma ${i + 1}`,
    distance: DISTANCE_ORDER[Math.floor(i / 3)],
  }))
}

beforeEach(async () => {
  await db.matchEntries.clear()
  await db.matches.clear()
  await db.roster.clear()
})

describe('validateRoster', () => {
  it('accepts 15 unique named rows with valid distances', () => {
    expect(validateRoster(makeRosterRows())).toEqual([])
  })

  it('rejects a roster that is not exactly 15 rows', () => {
    const errors = validateRoster(makeRosterRows().slice(0, 14))
    expect(errors).toEqual(['The roster needs exactly 15 umas (found 14).'])
  })

  it('rejects a blank name', () => {
    const rows = makeRosterRows()
    rows[2] = { ...rows[2], umaName: '   ' }
    expect(validateRoster(rows)).toEqual(['Row 3: uma name is required.'])
  })

  it('rejects duplicate names case-insensitively', () => {
    const rows = makeRosterRows()
    rows[5] = { ...rows[5], umaName: ' uma 1 ' }
    expect(validateRoster(rows)).toEqual(['uma 1 appears more than once — each uma must be unique.'])
  })

  it('rejects an unknown distance', () => {
    const rows = makeRosterRows()
    rows[0] = { ...rows[0], distance: 'Marathon' }
    expect(validateRoster(rows)).toEqual(['Row 1: "Marathon" is not a distance category.'])
  })
})

describe('sortRoster', () => {
  it('sorts by distance category order, then name', () => {
    const sorted = sortRoster([
      { umaName: 'B', distance: 'Dirt' },
      { umaName: 'Z', distance: 'Sprint' },
      { umaName: 'A', distance: 'Dirt' },
    ])
    expect(sorted.map((s) => s.umaName)).toEqual(['Z', 'A', 'B'])
  })
})

describe('createRoster', () => {
  it('stores trimmed slots and resolves to their ids in input order', async () => {
    const rows = makeRosterRows()
    rows[0] = { ...rows[0], umaName: '  Uma 1  ' }
    const ids = await createRoster(rows)

    expect(ids).toHaveLength(15)
    expect(await db.roster.get(ids[0])).toMatchObject({ umaName: 'Uma 1', distance: 'Sprint' })
    expect(await getRoster()).toHaveLength(15)
  })

  it('throws on an invalid roster without storing anything', async () => {
    await expect(createRoster(makeRosterRows().slice(0, 3))).rejects.toThrow('exactly 15')
    expect(await db.roster.count()).toBe(0)
  })

  it('refuses to create a second roster', async () => {
    await createRoster(makeRosterRows())
    await expect(createRoster(makeRosterRows())).rejects.toThrow('already exists')
    expect(await db.roster.count()).toBe(15)
  })
})

describe('resetRoster', () => {
  it('removes the roster and all matches and scores', async () => {
    const [id] = await createRoster(makeRosterRows())
    await addMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      matches: [{ entries: [{ rosterId: id, points: 40000 }] }],
    })

    await resetRoster()

    expect(await db.roster.count()).toBe(0)
    expect(await db.matches.count()).toBe(0)
    expect(await db.matchEntries.count()).toBe(0)
  })

  it('allows a new roster to be created afterwards', async () => {
    await createRoster(makeRosterRows())
    await resetRoster()
    await expect(createRoster(makeRosterRows())).resolves.toHaveLength(15)
  })
})

describe('updateRosterSlot', () => {
  it('renames and re-distances a slot that has no scores', async () => {
    const [id] = await createRoster(makeRosterRows())
    await updateRosterSlot(id, { umaName: ' New Uma ', distance: 'Long' })
    expect(await db.roster.get(id)).toMatchObject({ umaName: 'New Uma', distance: 'Long' })
  })

  it('refuses to edit a slot that still has scores', async () => {
    const [id] = await createRoster(makeRosterRows())
    await addMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      matches: [{ entries: [{ rosterId: id, points: 40000 }] }],
    })

    await expect(updateRosterSlot(id, { umaName: 'New Uma', distance: 'Long' })).rejects.toThrow(
      'scores'
    )
    expect(await db.roster.get(id)).toMatchObject({ umaName: 'Uma 1' })
  })

  it('edits a slot once its scores are deleted', async () => {
    const [id, other] = await createRoster(makeRosterRows())
    await addMatches({
      playedAt: '2026-01-01T00:00:00.000Z',
      matches: [{ entries: [{ rosterId: id, points: 40000 }, { rosterId: other, points: 30000 }] }],
    })
    await deleteUmaScores(id)

    await updateRosterSlot(id, { umaName: 'New Uma', distance: 'Long' })
    expect(await db.roster.get(id)).toMatchObject({ umaName: 'New Uma', distance: 'Long' })
  })

  it('refuses a name already used by another slot', async () => {
    const [id] = await createRoster(makeRosterRows())
    await expect(updateRosterSlot(id, { umaName: 'uma 2', distance: 'Sprint' })).rejects.toThrow(
      'already on the roster'
    )
  })

  it('allows saving a slot under its own current name', async () => {
    const [id] = await createRoster(makeRosterRows())
    await updateRosterSlot(id, { umaName: 'Uma 1', distance: 'Dirt' })
    expect(await db.roster.get(id)).toMatchObject({ umaName: 'Uma 1', distance: 'Dirt' })
  })

  it('rejects a blank name or unknown distance', async () => {
    const [id] = await createRoster(makeRosterRows())
    await expect(updateRosterSlot(id, { umaName: ' ', distance: 'Long' })).rejects.toThrow('required')
    await expect(updateRosterSlot(id, { umaName: 'X', distance: 'Marathon' })).rejects.toThrow(
      'not a distance'
    )
  })

  it('throws for a slot that does not exist', async () => {
    await expect(updateRosterSlot(999, { umaName: 'X', distance: 'Long' })).rejects.toThrow('not found')
  })
})
