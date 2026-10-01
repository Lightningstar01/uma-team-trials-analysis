import Dexie from 'dexie'

export const db = new Dexie('umaTeamTrialsDB')

db.version(1).stores({
  matches: '++id, playedAt',
  matchEntries: '++id, matchId, umaName',
})

// v2: the roster is a stored, user-set list of 15 slots, and each entry
// points at its slot by rosterId instead of by name. Old v1 history had no
// roster to attach to, so it's cleared (developer decision: start fresh).
db.version(2)
  .stores({
    roster: '++id',
    matches: '++id, playedAt',
    matchEntries: '++id, matchId, rosterId',
  })
  .upgrade(async (tx) => {
    await tx.table('matchEntries').clear()
    await tx.table('matches').clear()
  })
