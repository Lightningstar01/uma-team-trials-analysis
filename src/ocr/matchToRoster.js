function normalizeName(name) {
  return name.trim().toLowerCase()
}

function formatPoints(points) {
  return points === '' || points == null ? '' : ` (${Number(points).toLocaleString('en-US')} pts)`
}

// Lines up one match's OCR rows (already merged and batch-fallback-filled)
// with the stored roster by name. Returns one row per roster slot, in
// roster order, with points as an entry-grid string ('' when not found).
// Anything that doesn't line up becomes a warning rather than a guess: a
// roster uma OCR didn't find, an OCR uma that isn't on the roster, or an
// OCR distance that disagrees with the slot's.
export function mapOcrRowsToRoster(ocrRows, roster) {
  const warnings = []
  const ocrByName = new Map()
  for (const row of ocrRows) {
    if (row.umaName.trim() !== '') ocrByName.set(normalizeName(row.umaName), row)
  }

  const matched = new Set()
  const rows = roster.map((slot) => {
    const base = { rosterId: slot.id, umaName: slot.umaName, distance: slot.distance }
    const ocrRow = ocrByName.get(normalizeName(slot.umaName))

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
    return { ...base, points: ocrRow.points === '' || ocrRow.points == null ? '' : String(ocrRow.points) }
  })

  for (const row of ocrRows) {
    if (!matched.has(row) && row.umaName.trim() !== '') {
      warnings.push(
        `Screenshots show ${row.umaName}${formatPoints(row.points)}, who isn't on the roster — that score was not used.`
      )
    }
  }

  return { rows, warnings }
}
