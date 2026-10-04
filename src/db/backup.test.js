import { describe, it, expect, beforeEach } from 'vitest'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFileName,
  exportBackup,
  importBackup,
  parseBackupText,
  validateBackup,
} from './backup.js'
import { addMatches, deleteUmaScores } from './matches.js'
import { createRoster } from './roster.js'
import { db } from './db.js'
import { DISTANCE_ORDER } from './constants.js'

// 15 slots, 3 per distance: "Uma 1".."Uma 15".
function makeRosterRows() {
  return Array.from({ length: 15 }, (_, i) => ({
    umaName: `Uma ${i + 1}`,
    distance: DISTANCE_ORDER[Math.floor(i / 3)],
  }))
}

// A roster, two matches, and Uma 1's scores deleted (so the backup holds a
// deleted-score snapshot).
async function seedData() {
  const slotIds = await createRoster(makeRosterRows())
  await addMatches({
    playedAt: '2026-01-01T00:00:00.000Z',
    matches: [1, 2].map((n) => ({
      source: 'screenshot',
      entries: slotIds.map((rosterId, i) => ({ rosterId, points: (i + 1) * 1000 + n })),
    })),
  })
  await deleteUmaScores(slotIds[0])
}

async function readAllTables() {
  return {
    roster: await db.roster.toArray(),
    matches: await db.matches.toArray(),
    matchEntries: await db.matchEntries.toArray(),
  }
}

beforeEach(async () => {
  await db.matchEntries.clear()
  await db.matches.clear()
  await db.roster.clear()
})

describe('exportBackup', () => {
  it('returns every table with ids, tagged with format and version', async () => {
    await seedData()
    const backup = await exportBackup()

    expect(backup.format).toBe(BACKUP_FORMAT)
    expect(backup.version).toBe(BACKUP_VERSION)
    expect(typeof backup.exportedAt).toBe('string')
    expect(backup.roster).toHaveLength(15)
    expect(backup.matches).toHaveLength(2)
    expect(backup.matchEntries).toHaveLength(30)
    expect(backup.matchEntries.filter((entry) => entry.deleted)).toHaveLength(2)
  })
})

describe('importBackup', () => {
  it('restores exactly what was exported, deleted scores included', async () => {
    await seedData()
    const before = await readAllTables()
    const backup = JSON.parse(JSON.stringify(await exportBackup()))

    await db.matchEntries.clear()
    await db.matches.clear()
    await db.roster.clear()
    await importBackup(backup)

    expect(await readAllTables()).toEqual(before)
  })

  it('replaces whatever data was there before', async () => {
    await seedData()
    const backup = await exportBackup()

    await db.matchEntries.clear()
    await db.matches.clear()
    await db.roster.clear()
    const otherRows = makeRosterRows().map((row) => ({ ...row, umaName: `Other ${row.umaName}` }))
    await createRoster(otherRows)

    await importBackup(backup)

    const names = (await db.roster.toArray()).map((slot) => slot.umaName)
    expect(names).toHaveLength(15)
    expect(names.every((name) => name.startsWith('Uma '))).toBe(true)
  })

  it('drops fields the app does not store', async () => {
    await seedData()
    const backup = await exportBackup()
    backup.roster[0].extra = 'junk'

    await importBackup(backup)

    expect(await db.roster.get(backup.roster[0].id)).not.toHaveProperty('extra')
  })

  it('throws on an invalid backup and leaves existing data untouched', async () => {
    await seedData()
    const before = await readAllTables()
    const backup = await exportBackup()
    backup.matchEntries[0].points = 'lots'

    await expect(importBackup(backup)).rejects.toThrow('points must be a number')
    expect(await readAllTables()).toEqual(before)
  })
})

describe('validateBackup', () => {
  async function validBackup() {
    await seedData()
    return exportBackup()
  }

  it('accepts an exported backup', async () => {
    expect(validateBackup(await validBackup())).toEqual([])
  })

  it('rejects something that is not a backup', () => {
    const notBackup = ["This file isn't an Uma Team Trials Score Auditor backup."]
    expect(validateBackup(null)).toEqual(notBackup)
    expect(validateBackup([])).toEqual(notBackup)
    expect(validateBackup({ format: 'other' })).toEqual(notBackup)
  })

  it('rejects an unsupported version', () => {
    expect(validateBackup({ format: BACKUP_FORMAT, version: 99 })).toEqual([
      "This backup's version (99) isn't supported.",
    ])
  })

  it('rejects missing tables', () => {
    expect(
      validateBackup({ format: BACKUP_FORMAT, version: BACKUP_VERSION, roster: [], matches: [] })
    ).toEqual(['This backup is damaged: its roster, matches, or scores are missing.'])
  })

  it('applies the roster rules', async () => {
    const backup = await validBackup()
    backup.roster[1].umaName = backup.roster[0].umaName
    expect(validateBackup(backup)).toEqual(['Uma 1 appears more than once — each uma must be unique.'])
  })

  it('rejects a roster slot without a name', async () => {
    const backup = await validBackup()
    delete backup.roster[0].umaName
    expect(validateBackup(backup)).toEqual(['Every roster slot needs an uma name.'])
  })

  it('rejects missing and duplicate ids', async () => {
    const backup = await validBackup()
    delete backup.matches[0].id
    backup.matchEntries[1].id = backup.matchEntries[0].id
    const errors = validateBackup(backup)
    expect(errors).toContain('Match 1: missing or invalid id.')
    expect(errors).toContain(`Score 2: id ${backup.matchEntries[0].id} is used more than once.`)
  })

  it('rejects a match without a date', async () => {
    const backup = await validBackup()
    delete backup.matches[1].playedAt
    expect(validateBackup(backup)).toEqual(['Match 2: missing its date.'])
  })

  it('rejects scores that point at a missing match or slot', async () => {
    const backup = await validBackup()
    backup.matchEntries[0].matchId = 999
    backup.matchEntries[0].rosterId = 999
    expect(validateBackup(backup)).toEqual([
      "Score 1: belongs to a match that isn't in the backup.",
      "Score 1: belongs to a roster slot that isn't in the backup.",
    ])
  })

  it('rejects a damaged deleted-uma snapshot', async () => {
    const backup = await validBackup()
    const index = backup.matchEntries.findIndex((entry) => entry.deleted)
    backup.matchEntries[index].deleted = { umaName: 'Uma 1' }
    expect(validateBackup(backup)).toEqual([`Score ${index + 1}: its deleted-uma record is damaged.`])
  })
})

describe('parseBackupText', () => {
  it('parses JSON', () => {
    expect(parseBackupText('{"a":1}')).toEqual({ a: 1 })
  })

  it('throws a friendly error for non-JSON', () => {
    expect(() => parseBackupText('not json')).toThrow("isn't a valid backup file")
  })
})

describe('backupFileName', () => {
  it('names the file by local date', () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 30))).toBe('uma-team-trials-backup-2026-01-05.json')
  })
})
