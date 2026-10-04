import { describe, it, expect } from 'vitest'
import { findBadPoints, findRosterMismatch, toSetupGridRows } from './matchEntry.js'
import { sampleMatch } from '../ocr/__fixtures__/sampleMatch.js'

const ROSTER_ROWS = sampleMatch.map(({ umaName, distance }) => ({ umaName, distance }))

describe('toSetupGridRows', () => {
  it('keeps OCR order and stringifies points', () => {
    const { rows, warnings } = toSetupGridRows(sampleMatch, [])
    expect(rows[0]).toEqual({ umaName: 'Super Creek', distance: 'Long', points: '80936' })
    expect(rows).toHaveLength(15)
    expect(warnings).toEqual([])
  })

  it('defaults a null distance to the first category', () => {
    const ocrRows = sampleMatch.map((row, i) => (i === 0 ? { ...row, distance: null } : row))
    expect(toSetupGridRows(ocrRows, []).rows[0].distance).toBe('Sprint')
  })

  it('drops extra rows past 15 and warns', () => {
    const ocrRows = [...sampleMatch, { umaName: 'Vodka', distance: 'Mile', points: 1 }]
    const { rows, warnings } = toSetupGridRows(ocrRows, ['earlier'])
    expect(rows).toHaveLength(15)
    expect(warnings).toEqual(['earlier', 'Found 16 rows, expected 15 — the extra rows were dropped.'])
  })

  it('pads missing rows with blanks and warns', () => {
    const { rows, warnings } = toSetupGridRows(sampleMatch.slice(0, 13), [])
    expect(rows).toHaveLength(15)
    expect(rows[14]).toEqual({ umaName: '', distance: 'Sprint', points: '' })
    expect(warnings).toEqual([
      'Found 13 rows, expected 15 — the missing rows were left blank, please fill them in.',
    ])
  })
})

describe('findBadPoints', () => {
  it('returns undefined when every row has a positive whole number', () => {
    expect(findBadPoints([{ points: '1' }, { points: 40000 }])).toBeUndefined()
  })

  it.each(['', '1.5', '0', '-3', 'abc'])('flags points of %j', (points) => {
    const bad = { umaName: 'X', points }
    expect(findBadPoints([{ points: '5' }, bad])).toBe(bad)
  })
})

describe('findRosterMismatch', () => {
  it('accepts the same umas at the same distances, in any order and case', () => {
    const rows = [...ROSTER_ROWS].reverse().map((row) => ({ ...row, umaName: row.umaName.toUpperCase() }))
    expect(findRosterMismatch(ROSTER_ROWS, rows)).toBeNull()
  })

  it('rejects a different number of umas', () => {
    expect(findRosterMismatch(ROSTER_ROWS, ROSTER_ROWS.slice(1))).toBe('has 14 umas, but Match 1 has 15.')
  })

  it('rejects an uma that is not in Match 1', () => {
    const rows = ROSTER_ROWS.map((row, i) => (i === 0 ? { ...row, umaName: 'Vodka' } : row))
    expect(findRosterMismatch(ROSTER_ROWS, rows)).toBe(
      "Vodka isn't in Match 1 — every match in a batch must have the same roster."
    )
  })

  it('rejects an uma at a different distance', () => {
    const rows = ROSTER_ROWS.map((row, i) => (i === 0 ? { ...row, distance: 'Sprint' } : row))
    expect(findRosterMismatch(ROSTER_ROWS, rows)).toBe('Super Creek is Sprint here but Long in Match 1.')
  })

  it('rejects an uma listed twice in place of another', () => {
    const rows = ROSTER_ROWS.map((row, i) => (i === 1 ? { ...ROSTER_ROWS[0] } : row))
    expect(findRosterMismatch(ROSTER_ROWS, rows)).toBe('Super Creek appears more than once in this match.')
  })
})
