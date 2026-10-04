import { normalizeName } from '../db/constants.js'

function hasPoints(row) {
  return row.points !== '' && row.points != null
}

function formatPoints(points) {
  return points === '' || points == null ? '' : ` (${Number(points).toLocaleString('en-US')} pts)`
}

// Lines up one match's OCR rows (already merged and batch-fallback-filled)
// with the stored roster by name. Returns one row per roster slot, in
// roster order, with points as an entry-grid string ('' when not found).
// Name and distance always come from the roster slot.
//
// One OCR misread is fixed by elimination against the roster: if exactly
// one slot has no matching row and exactly one leftover row names an uma
// who isn't on the roster, that row is the slot's (unless its distance
// disagrees with the slot's, which suggests it isn't). Anything else that
// doesn't line up becomes a warning rather than a guess: a roster uma OCR
// didn't find, an OCR uma that isn't on the roster, a repeated row, or an
// OCR distance that disagrees with the slot's.
export function mapOcrRowsToRoster(ocrRows, roster) {
  const warnings = []
  const rosterNames = new Set(roster.map((slot) => normalizeName(slot.umaName)))

  // If two rows share a name (e.g. an extra noise row corrected to a real
  // uma), the first one with points wins; the other is reported below.
  const ocrByName = new Map()
  for (const row of ocrRows) {
    if (row.umaName.trim() === '') continue
    const key = normalizeName(row.umaName)
    const existing = ocrByName.get(key)
    if (!existing || (!hasPoints(existing) && hasPoints(row))) ocrByName.set(key, row)
  }

  const rowBySlot = new Map()
  for (const slot of roster) {
    const ocrRow = ocrByName.get(normalizeName(slot.umaName))
    if (ocrRow) rowBySlot.set(slot, ocrRow)
  }

  const missingSlots = roster.filter((slot) => !rowBySlot.has(slot))
  const offRoster = ocrRows.filter(
    (row) => row.umaName.trim() !== '' && !rosterNames.has(normalizeName(row.umaName))
  )
  if (missingSlots.length === 1 && offRoster.length === 1) {
    const [slot] = missingSlots
    const [row] = offRoster
    if (row.distance == null || row.distance === slot.distance) {
      rowBySlot.set(slot, row)
      warnings.push(
        `${slot.umaName}: screenshots show "${row.umaName}", the only name not on the roster — matched to ${slot.umaName} by elimination, please verify.`
      )
    }
  }

  const matched = new Set()
  const rows = roster.map((slot) => {
    const base = { rosterId: slot.id, umaName: slot.umaName, distance: slot.distance }
    const ocrRow = rowBySlot.get(slot)

    if (!ocrRow) {
      warnings.push(`${slot.umaName}: not found in the screenshots — please enter the points.`)
      return { ...base, points: '' }
    }

    matched.add(ocrRow)
    if (ocrRow.distance && ocrRow.distance !== slot.distance) {
      warnings.push(
        `${slot.umaName}: screenshots show ${ocrRow.distance}, but the roster has ${slot.distance}.`
      )
    }
    return { ...base, points: hasPoints(ocrRow) ? String(ocrRow.points) : '' }
  })

  for (const row of ocrRows) {
    if (matched.has(row) || row.umaName.trim() === '') continue
    if (rosterNames.has(normalizeName(row.umaName))) {
      warnings.push(
        `Screenshots show ${row.umaName} more than once — the extra row${formatPoints(row.points)} was not used.`
      )
    } else {
      warnings.push(
        `Screenshots show ${row.umaName}${formatPoints(row.points)}, who isn't on the roster — that score was not used.`
      )
    }
  }

  return { rows, warnings }
}
