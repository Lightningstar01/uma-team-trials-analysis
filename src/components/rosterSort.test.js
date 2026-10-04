import { describe, it, expect } from 'vitest'
import { nextSort, sortEntryRowsByPoints, sortRosterStats } from './rosterSort.js'

const STATS = [
  { id: 1, umaName: 'Bravo', distance: 'Sprint', average: 300, high: 400, low: 200, matchCount: 2 },
  { id: 2, umaName: 'Alpha', distance: 'Long', average: null, high: null, low: null, matchCount: 0 },
  { id: 3, umaName: 'Charlie', distance: 'Mile', average: 100, high: 150, low: 50, matchCount: 5 },
]

const ids = (stats) => stats.map((s) => s.id)

describe('sortRosterStats', () => {
  it('sorts numbers ascending and descending, keeping unscored slots last', () => {
    expect(ids(sortRosterStats(STATS, { key: 'average', direction: 'asc' }))).toEqual([3, 1, 2])
    expect(ids(sortRosterStats(STATS, { key: 'average', direction: 'desc' }))).toEqual([1, 3, 2])
  })

  it('sorts names alphabetically', () => {
    expect(ids(sortRosterStats(STATS, { key: 'umaName', direction: 'asc' }))).toEqual([2, 1, 3])
    expect(ids(sortRosterStats(STATS, { key: 'umaName', direction: 'desc' }))).toEqual([3, 1, 2])
  })

  it('sorts distance by category order, not alphabetically', () => {
    expect(ids(sortRosterStats(STATS, { key: 'distance', direction: 'asc' }))).toEqual([1, 3, 2])
  })

  it('sorts a zero match count like any other number', () => {
    expect(ids(sortRosterStats(STATS, { key: 'matchCount', direction: 'asc' }))).toEqual([2, 1, 3])
  })

  it('keeps the incoming order for ties', () => {
    const tied = [
      { id: 'a', average: 5 },
      { id: 'b', average: 5 },
    ]
    expect(ids(sortRosterStats(tied, { key: 'average', direction: 'desc' }))).toEqual(['a', 'b'])
  })

  it('does not mutate the input', () => {
    const copy = [...STATS]
    sortRosterStats(STATS, { key: 'average', direction: 'asc' })
    expect(STATS).toEqual(copy)
  })
})

describe('sortEntryRowsByPoints', () => {
  it('orders rows by points, highest first, comparing numerically', () => {
    const rows = [
      { id: 1, points: '9000' },
      { id: 2, points: '78851' },
      { id: 3, points: '45216' },
    ]
    expect(ids(sortEntryRowsByPoints(rows))).toEqual([2, 3, 1])
  })

  it('puts blank points last, keeping incoming order for blanks and ties', () => {
    const rows = [
      { id: 1, points: '' },
      { id: 2, points: '500' },
      { id: 3, points: '' },
      { id: 4, points: '500' },
    ]
    expect(ids(sortEntryRowsByPoints(rows))).toEqual([2, 4, 1, 3])
  })

  it('does not mutate the input', () => {
    const rows = [{ id: 1, points: '1' }, { id: 2, points: '2' }]
    sortEntryRowsByPoints(rows)
    expect(ids(rows)).toEqual([1, 2])
  })
})

describe('nextSort', () => {
  it('starts a new column ascending', () => {
    expect(nextSort({ key: 'distance', direction: 'desc' }, 'average')).toEqual({
      key: 'average',
      direction: 'asc',
    })
  })

  it('flips the direction of the active column', () => {
    expect(nextSort({ key: 'average', direction: 'asc' }, 'average')).toEqual({
      key: 'average',
      direction: 'desc',
    })
    expect(nextSort({ key: 'average', direction: 'desc' }, 'average')).toEqual({
      key: 'average',
      direction: 'asc',
    })
  })
})
