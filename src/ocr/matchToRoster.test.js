import { describe, it, expect } from 'vitest'
import { mapOcrRowsToRoster } from './matchToRoster.js'

const ROSTER = [
  { id: 1, umaName: 'Special Week', distance: 'Medium' },
  { id: 2, umaName: 'Silence Suzuka', distance: 'Mile' },
]

describe('mapOcrRowsToRoster', () => {
  it('fills points by name, in roster order, regardless of OCR order', () => {
    const { rows, warnings } = mapOcrRowsToRoster(
      [
        { umaName: 'Silence Suzuka', distance: 'Mile', points: 50000 },
        { umaName: 'Special Week', distance: 'Medium', points: 45000 },
      ],
      ROSTER
    )
    expect(rows).toEqual([
      { rosterId: 1, umaName: 'Special Week', distance: 'Medium', points: '45000' },
      { rosterId: 2, umaName: 'Silence Suzuka', distance: 'Mile', points: '50000' },
    ])
    expect(warnings).toEqual([])
  })

  it('matches names case- and whitespace-insensitively', () => {
    const { rows } = mapOcrRowsToRoster(
      [{ umaName: ' special week ', distance: 'Medium', points: 45000 }],
      ROSTER
    )
    expect(rows[0].points).toBe('45000')
  })

  it('leaves points blank and warns for a roster uma OCR did not find', () => {
    const { rows, warnings } = mapOcrRowsToRoster(
      [{ umaName: 'Special Week', distance: 'Medium', points: 45000 }],
      ROSTER
    )
    expect(rows[1].points).toBe('')
    expect(warnings).toEqual([
      'Silence Suzuka: not found in the screenshots — please enter the points.',
    ])
  })

  it('keeps a blank OCR points value blank without a not-found warning', () => {
    const { rows, warnings } = mapOcrRowsToRoster(
      [
        { umaName: 'Special Week', distance: 'Medium', points: '' },
        { umaName: 'Silence Suzuka', distance: 'Mile', points: 50000 },
      ],
      ROSTER
    )
    expect(rows[0].points).toBe('')
    expect(warnings).toEqual([])
  })

  it('warns about an OCR uma that is not on the roster', () => {
    const { warnings } = mapOcrRowsToRoster(
      [
        { umaName: 'Special Week', distance: 'Medium', points: 45000 },
        { umaName: 'Silence Suzuka', distance: 'Mile', points: 50000 },
        { umaName: 'Oguri Cap', distance: 'Long', points: 42711 },
      ],
      ROSTER
    )
    expect(warnings).toEqual([
      "Screenshots show Oguri Cap (42,711 pts), who isn't on the roster — that score was not used.",
    ])
  })

  it('keeps the scored row when a later row has the same name but no points', () => {
    const { rows, warnings } = mapOcrRowsToRoster(
      [
        { umaName: 'Special Week', distance: 'Medium', points: 45000 },
        { umaName: 'Silence Suzuka', distance: 'Mile', points: 50000 },
        { umaName: 'Special Week', distance: 'Medium', points: '' },
      ],
      ROSTER
    )
    expect(rows[0].points).toBe('45000')
    expect(warnings).toEqual(['Screenshots show Special Week more than once — the extra row was not used.'])
  })

  it('prefers a later scored row over an earlier blank row with the same name', () => {
    const { rows, warnings } = mapOcrRowsToRoster(
      [
        { umaName: 'Special Week', distance: 'Medium', points: '' },
        { umaName: 'Special Week', distance: 'Medium', points: 45000 },
        { umaName: 'Silence Suzuka', distance: 'Mile', points: 50000 },
      ],
      ROSTER
    )
    expect(rows[0].points).toBe('45000')
    expect(warnings).toEqual(['Screenshots show Special Week more than once — the extra row was not used.'])
  })

  it('keeps the first scored row when two same-name rows both have points', () => {
    const { rows, warnings } = mapOcrRowsToRoster(
      [
        { umaName: 'Special Week', distance: 'Medium', points: 45000 },
        { umaName: 'Special Week', distance: 'Medium', points: 12345 },
        { umaName: 'Silence Suzuka', distance: 'Mile', points: 50000 },
      ],
      ROSTER
    )
    expect(rows[0].points).toBe('45000')
    expect(warnings).toEqual([
      'Screenshots show Special Week more than once — the extra row (12,345 pts) was not used.',
    ])
  })

  it('matches the only off-roster row to the only missing slot by elimination', () => {
    const { rows, warnings } = mapOcrRowsToRoster(
      [
        { umaName: 'Special Week', distance: 'Medium', points: 45000 },
        { umaName: 'Smart Falcon', correctedFrom: 'Snart Faicon', distance: null, points: 50000 },
      ],
      ROSTER
    )
    expect(rows[1]).toEqual({ rosterId: 2, umaName: 'Silence Suzuka', distance: 'Mile', points: '50000' })
    expect(warnings).toEqual([
      'Silence Suzuka: screenshots show "Smart Falcon", the only name not on the roster — matched to Silence Suzuka by elimination, please verify.',
    ])
  })

  it('does not match by elimination when the leftover row has a different distance than the slot', () => {
    const { rows, warnings } = mapOcrRowsToRoster(
      [
        { umaName: 'Special Week', distance: 'Medium', points: 45000 },
        { umaName: 'Smart Falcon', distance: 'Dirt', points: 50000 },
      ],
      ROSTER
    )
    expect(rows[1].points).toBe('')
    expect(warnings).toEqual([
      'Silence Suzuka: not found in the screenshots — please enter the points.',
      "Screenshots show Smart Falcon (50,000 pts), who isn't on the roster — that score was not used.",
    ])
  })

  it('does not match by elimination when more than one row is off the roster', () => {
    const { rows } = mapOcrRowsToRoster(
      [
        { umaName: 'Special Week', distance: 'Medium', points: 45000 },
        { umaName: 'Smart Falcon', distance: null, points: 50000 },
        { umaName: 'Oguri Cap', distance: null, points: 42711 },
      ],
      ROSTER
    )
    expect(rows[1].points).toBe('')
  })

  it('does not match by elimination when more than one slot is missing', () => {
    const { rows } = mapOcrRowsToRoster(
      [{ umaName: 'Smart Falcon', distance: null, points: 50000 }],
      ROSTER
    )
    expect(rows.map((row) => row.points)).toEqual(['', ''])
  })

  it('warns when the OCR distance disagrees with the roster, but still fills points', () => {
    const { rows, warnings } = mapOcrRowsToRoster(
      [
        { umaName: 'Special Week', distance: 'Long', points: 45000 },
        { umaName: 'Silence Suzuka', distance: null, points: 50000 },
      ],
      ROSTER
    )
    expect(rows[0].points).toBe('45000')
    expect(warnings).toEqual(['Special Week: screenshots show Long, but the roster has Medium.'])
  })
})
