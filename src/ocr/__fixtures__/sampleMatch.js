// The 15-row sample match from docs/team-trials-reference.md's Score Info
// table, factored out for reuse in OCR parsing tests. Ranked by points,
// highest first, matching the real Score_Info_1.jpg / Score_Info_2.jpg
// fixtures.
export const sampleMatch = [
  { umaName: 'Super Creek', distance: 'Long', points: 80936 },
  { umaName: 'Silence Suzuka', distance: 'Sprint', points: 70840 },
  { umaName: 'Curren Chan', distance: 'Sprint', points: 69225 },
  { umaName: 'Mihono Bourbon', distance: 'Medium', points: 68526 },
  { umaName: 'Maruzensky', distance: 'Mile', points: 66503 },
  { umaName: 'Taiki Shuttle', distance: 'Dirt', points: 65039 },
  { umaName: 'El Condor Pasa', distance: 'Mile', points: 64481 },
  { umaName: 'Air Groove', distance: 'Sprint', points: 60294 },
  { umaName: 'Special Week', distance: 'Medium', points: 57362 },
  { umaName: 'Smart Falcon', distance: 'Dirt', points: 56383 },
  { umaName: 'Agnes Tachyon', distance: 'Medium', points: 56107 },
  { umaName: 'Grass Wonder', distance: 'Long', points: 53976 },
  { umaName: 'Matikanetannhauser', distance: 'Long', points: 51450 },
  { umaName: 'Haru Urara', distance: 'Dirt', points: 41312 },
  { umaName: 'Gold City', distance: 'Mile', points: 39918 },
]

// The row genuinely split across both real screenshots (see
// docs/decisions.md): screenshot 1 captures its name+points but the
// distance pill is cut off at the bottom edge; screenshot 2's leading
// fragment for it doesn't OCR into anything usable at all.
export const SPLIT_ROW_NAME = 'Air Groove'
