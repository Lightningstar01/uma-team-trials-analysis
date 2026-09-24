import Dexie from 'dexie'

export const db = new Dexie('umaTeamTrialsDB')

db.version(1).stores({
  matches: '++id, playedAt',
  matchEntries: '++id, matchId, umaName',
})
