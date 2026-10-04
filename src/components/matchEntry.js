import { DISTANCE_ORDER, ROSTER_SIZE, normalizeName } from '../db/constants'

function blankRow() {
  return { umaName: '', distance: DISTANCE_ORDER[0], points: '' }
}

// Setup mode (no roster yet): OCR rows stay in the screenshots' own order
// so the grid can be fact-checked row-by-row against the phone. A null
// distance is coalesced to a valid <select> value; the OCR warning is what
// tells the user to double-check that row.
export function toSetupGridRows(ocrRows, ocrWarnings) {
  const warnings = [...ocrWarnings]
  const rows = ocrRows.slice(0, ROSTER_SIZE).map((row) => ({
    umaName: row.umaName,
    distance: row.distance ?? DISTANCE_ORDER[0],
    points: String(row.points),
  }))

  if (ocrRows.length > ROSTER_SIZE) {
    warnings.push(`Found ${ocrRows.length} rows, expected ${ROSTER_SIZE} — the extra rows were dropped.`)
  } else if (ocrRows.length < ROSTER_SIZE) {
    warnings.push(
      `Found ${ocrRows.length} rows, expected ${ROSTER_SIZE} — the missing rows were left blank, please fill them in.`
    )
  }
  while (rows.length < ROSTER_SIZE) rows.push(blankRow())

  return { rows, warnings }
}

// The first row whose points aren't a positive whole number, or undefined.
export function findBadPoints(rows) {
  return rows.find((row) => {
    const points = Number(row.points)
    return row.points === '' || !Number.isInteger(points) || points <= 0
  })
}

// Setup-mode check: every match in the batch must have match 1's umas, each
// exactly once, at the same distances (batch roster assumption - see
// docs/decisions.md). Returns the problem as a message, or null.
export function findRosterMismatch(rosterRows, rows) {
  const distanceByName = new Map(rosterRows.map((r) => [normalizeName(r.umaName), r.distance]))
  if (rows.length !== rosterRows.length) return `has ${rows.length} umas, but Match 1 has ${rosterRows.length}.`
  const seen = new Set()
  for (const row of rows) {
    const key = normalizeName(row.umaName)
    const rosterDistance = distanceByName.get(key)
    if (rosterDistance === undefined) return `${row.umaName} isn't in Match 1 — every match in a batch must have the same roster.`
    if (seen.has(key)) return `${row.umaName} appears more than once in this match.`
    if (rosterDistance !== row.distance) return `${row.umaName} is ${row.distance} here but ${rosterDistance} in Match 1.`
    seen.add(key)
  }
  return null
}
