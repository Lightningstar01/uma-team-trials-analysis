import { describe, it, expect } from 'vitest'
import { UMA_NAMES, lookupUmaName } from './umaNames.js'

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
