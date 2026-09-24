import { describe, it, expect } from 'vitest'
import { UMA_NAMES, lookupUmaName, closestUmaName, resolveUmaName } from './umaNames.js'

describe('lookupUmaName', () => {
  it('returns the canonical spelling for an exact match', () => {
    expect(lookupUmaName('El Condor Pasa')).toBe('El Condor Pasa')
  })

  it('is case-insensitive', () => {
    expect(lookupUmaName('el condor pasa')).toBe('El Condor Pasa')
    expect(lookupUmaName('EL CONDOR PASA')).toBe('El Condor Pasa')
  })

  it('trims surrounding whitespace', () => {
    expect(lookupUmaName('  Gold Ship  ')).toBe('Gold Ship')
  })

  it('returns null for unrecognized text', () => {
    expect(lookupUmaName('Not A Real Uma')).toBeNull()
  })

  it('returns null for a partial name (not fuzzy)', () => {
    expect(lookupUmaName('El Condor')).toBeNull()
  })

  it('has no duplicate entries once normalized', () => {
    const normalized = UMA_NAMES.map((name) => name.trim().toLowerCase())
    expect(new Set(normalized).size).toBe(normalized.length)
  })
})

describe('closestUmaName', () => {
  it('returns the exact match with distance 0', () => {
    expect(closestUmaName('Oguri Cap')).toEqual({ name: 'Oguri Cap', distance: 0 })
  })

  it('finds the nearest name for a garbled real-fixture misread', () => {
    // Real Score_Info_3b.jpg misread (see docs/decisions.md): "Oguri Cap" -> "guri Cap".
    expect(closestUmaName('guri Cap')).toEqual({ name: 'Oguri Cap', distance: 1 })
  })

  it('is case/whitespace-insensitive like lookupUmaName', () => {
    expect(closestUmaName('  oguri cap  ')).toEqual({ name: 'Oguri Cap', distance: 0 })
  })
})

describe('resolveUmaName', () => {
  it('marks an exact match as exact', () => {
    expect(resolveUmaName('Oguri Cap')).toEqual({ name: 'Oguri Cap', exact: true })
  })

  it('marks a corrected name as inexact', () => {
    expect(resolveUmaName('guri Cap')).toEqual({ name: 'Oguri Cap', exact: false })
  })
})
