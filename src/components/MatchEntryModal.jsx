import { useEffect, useRef, useState } from 'react'
import { DISTANCE_ORDER, ROSTER_SIZE } from '../db/constants'
import { addMatches, createRosterWithMatches } from '../db/matches'
import { validateRoster } from '../db/roster'
import { validateRows } from '../ocr/parseScoreInfo'
import { mapOcrRowsToRoster } from '../ocr/matchToRoster'

function normalizeName(name) {
  return name.trim().toLowerCase()
}

function blankRow() {
  return { umaName: '', distance: DISTANCE_ORDER[0], points: '' }
}

// Setup mode (no roster yet): OCR rows stay in the screenshots' own order
// so the grid can be fact-checked row-by-row against the phone. A null
// distance is coalesced to a valid <select> value; the OCR warning is what
// tells the user to double-check that row.
function toSetupGridRows(ocrRows, ocrWarnings) {
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

function toDrafts(ocrMatches, roster) {
  return ocrMatches.map(({ rows, warnings }) => {
    const shaped =
      roster.length === 0 ? toSetupGridRows(rows, warnings) : mapOcrRowsToRoster(rows, roster)
    return {
      source: 'ocr',
      rows: shaped.rows,
      warnings: roster.length === 0 ? shaped.warnings : [...warnings, ...shaped.warnings],
    }
  })
}

function toLocalDatetimeValue(date) {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function findBadPoints(rows) {
  return rows.find((row) => {
    const points = Number(row.points)
    return row.points === '' || !Number.isInteger(points) || points <= 0
  })
}

// Setup-mode check: every match in the batch must have match 1's umas, at
// the same distances (batch roster assumption - see docs/decisions.md).
function findRosterMismatch(rosterRows, rows) {
  const distanceByName = new Map(rosterRows.map((r) => [normalizeName(r.umaName), r.distance]))
  if (rows.length !== rosterRows.length) return `has ${rows.length} umas, but Match 1 has ${rosterRows.length}.`
  for (const row of rows) {
    const rosterDistance = distanceByName.get(normalizeName(row.umaName))
    if (rosterDistance === undefined) return `${row.umaName} isn't in Match 1 — every match in a batch must have the same roster.`
    if (rosterDistance !== row.distance) return `${row.umaName} is ${row.distance} here but ${rosterDistance} in Match 1.`
  }
  return null
}

// One modal for both entry paths. With a roster, rows are the 15 roster
// slots and only points are editable. Without one (auto-fill setup), rows
// are free name/distance/points and match 1 becomes the roster on save.
function MatchEntryModal({ request, roster: rosterAtOpen, onClose }) {
  // Snapshot at open: saving in setup mode creates the roster, and the
  // grid shouldn't switch modes underneath the user while that happens.
  const [roster] = useState(rosterAtOpen)
  const isSetup = roster.length === 0

  const dialogRef = useRef(null)
  const [status, setStatus] = useState(request.kind === 'screenshots' ? 'processing' : 'ready')
  const [loadError, setLoadError] = useState('')
  const [drafts, setDrafts] = useState(() =>
    request.kind === 'manual'
      ? [{ source: 'manual', rows: roster.map((slot) => ({ rosterId: slot.id, ...slot, points: '' })), warnings: [] }]
      : []
  )
  const [page, setPage] = useState(0)
  const [playedAt, setPlayedAt] = useState(() => toLocalDatetimeValue(new Date()))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialogRef.current.showModal()
  }, [])

  useEffect(() => {
    if (!request.pending) return
    let ignore = false
    request.pending.then(
      (ocrMatches) => {
        if (ignore) return
        setDrafts(toDrafts(ocrMatches, roster))
        setStatus('ready')
      },
      (failure) => {
        if (ignore) return
        setLoadError(failure.message)
        setStatus('error')
      }
    )
    return () => {
      ignore = true
    }
  }, [request, roster])

  const close = () => dialogRef.current.close()

  const updateRow = (rowIndex, field, value) => {
    setDrafts((prev) =>
      prev.map((draft, i) =>
        i !== page
          ? draft
          : { ...draft, rows: draft.rows.map((row, ri) => (ri === rowIndex ? { ...row, [field]: value } : row)) }
      )
    )
  }

  const handleSave = async () => {
    setError('')
    const fail = (matchIndex, message) => {
      setError(`${drafts.length > 1 ? `Match ${matchIndex + 1}: ` : ''}${message}`)
      setPage(matchIndex)
    }

    if (!playedAt) {
      setError('Enter the match date.')
      return
    }
    const playedAtIso = new Date(playedAt).toISOString()

    const filled = drafts.map((draft) =>
      isSetup ? draft.rows.filter((row) => row.umaName.trim() !== '') : draft.rows
    )

    let rosterRows = []
    if (isSetup) {
      rosterRows = filled[0].map(({ umaName, distance }) => ({ umaName: umaName.trim(), distance }))
      const rosterErrors = validateRoster(rosterRows)
      if (rosterErrors.length > 0) return fail(0, rosterErrors[0])
    }

    for (const [matchIndex, rows] of filled.entries()) {
      if (isSetup && matchIndex > 0) {
        const mismatch = findRosterMismatch(rosterRows, rows)
        if (mismatch) return fail(matchIndex, mismatch)
      }
      const bad = findBadPoints(rows)
      if (bad) return fail(matchIndex, `${bad.umaName.trim()}: points must be a positive whole number.`)
    }

    setSaving(true)
    try {
      if (isSetup) {
        await createRosterWithMatches({
          playedAt: playedAtIso,
          roster: rosterRows,
          matches: filled.map((rows, i) => ({
            source: drafts[i].source,
            rows: rows.map((row) => ({ umaName: row.umaName, points: Number(row.points) })),
          })),
        })
      } else {
        await addMatches({
          playedAt: playedAtIso,
          matches: filled.map((rows, i) => ({
            source: drafts[i].source,
            entries: rows.map((row) => ({ rosterId: row.rosterId, points: Number(row.points) })),
          })),
        })
      }
      close()
    } catch (saveError) {
      setError(saveError.message)
      setSaving(false)
    }
  }

  const draft = drafts[page]
  const warnings = draft ? [...draft.warnings, ...validateRows(draft.rows)] : []
  const isLastPage = page === drafts.length - 1

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onClose={onClose}
      onCancel={(event) => saving && event.preventDefault()}
    >
      <div className="modal-head">
        <h2>{isSetup ? 'Review your roster' : 'Log a match'}</h2>
        <button type="button" className="icon-btn" onClick={close} disabled={saving} aria-label="Close">
          ×
        </button>
      </div>

      <div className="modal-body">
        {status === 'processing' && (
          <div className="processing">
            <span className="spinner" aria-hidden="true" />
            <p>Reading screenshots… this takes a few seconds per screenshot.</p>
          </div>
        )}

        {status === 'error' && <p className="error-text">{loadError}</p>}

        {status === 'ready' && draft && (
          <>
            <div className="modal-meta">
              <label>
                <span>{drafts.length > 1 ? 'Date (all matches)' : 'Match date'}</span>
                <input type="datetime-local" value={playedAt} onChange={(event) => setPlayedAt(event.target.value)} />
              </label>
              {drafts.length > 1 && (
                <p className="pager-label">
                  Match {page + 1} of {drafts.length}
                </p>
              )}
            </div>

            {isSetup && (
              <p className="hint">
                Check each name and distance — Match 1's umas become your roster when you save.
              </p>
            )}
            {drafts.length > 1 && (
              <p className="hint">
                Batches assume every match has the identical 15-uma roster, including each uma's distance. If
                your roster changed partway through, upload separate batches instead.
              </p>
            )}

            {warnings.length > 0 && (
              <ul className="warnings">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}

            <div className="table-scroll">
              <table className="compact entry-table">
                <thead>
                  <tr>
                    <th>Uma</th>
                    <th>Distance</th>
                    <th className="num">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.rows.map((row, rowIndex) => (
                    <tr key={row.rosterId ?? rowIndex}>
                      {isSetup ? (
                        <>
                          <td>
                            <input
                              type="text"
                              list="uma-names"
                              value={row.umaName}
                              onChange={(event) => updateRow(rowIndex, 'umaName', event.target.value)}
                              placeholder="Uma name"
                              aria-label={`Row ${rowIndex + 1} uma name`}
                            />
                          </td>
                          <td>
                            <select
                              value={row.distance}
                              onChange={(event) => updateRow(rowIndex, 'distance', event.target.value)}
                              aria-label={`Row ${rowIndex + 1} distance`}
                            >
                              {DISTANCE_ORDER.map((distance) => (
                                <option key={distance}>{distance}</option>
                              ))}
                            </select>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{row.umaName}</td>
                          <td>
                            <span className={`distance distance-${row.distance.toLowerCase()}`}>{row.distance}</span>
                          </td>
                        </>
                      )}
                      <td className="num">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={row.points}
                          onChange={(event) => updateRow(rowIndex, 'points', event.target.value)}
                          placeholder="Points"
                          aria-label={`${row.umaName || `Row ${rowIndex + 1}`} points`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <p className="error-text">{error}</p>}
          </>
        )}
      </div>

      <div className="modal-foot">
        <button type="button" className="btn" onClick={close} disabled={saving}>
          Cancel
        </button>
        {status === 'ready' && draft && (
          <div className="button-row">
            {drafts.length > 1 && (
              <button type="button" className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Back
              </button>
            )}
            {isLastPage ? (
              <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
                {drafts.length > 1 ? `Save ${drafts.length} matches` : 'Save match'}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setPage(page + 1)}>
                Next
              </button>
            )}
          </div>
        )}
      </div>
    </dialog>
  )
}

export default MatchEntryModal
