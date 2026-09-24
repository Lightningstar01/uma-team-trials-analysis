import { useEffect, useRef, useState } from 'react'
import { DISTANCE_ORDER } from '../db/constants'
import { addMatch, getLatestMatchEntries } from '../db/matches'
import { validateScreenshotFile } from '../ocr/imageValidation'
import { recognizeImage } from '../ocr/tesseractClient'
import { parseScreenshotRows, mergeScreenshotRows, findLeadingDistance } from '../ocr/parseScoreInfo'

const ROSTER_SIZE = 15
// Sanity cap on a single upload, not a game-mechanic limit - just a guard
// against an accidental pathological batch (20 matches' worth of pairs).
const MAX_SCREENSHOTS_PER_BATCH = 40

const BLANK_ROWS = Array.from({ length: ROSTER_SIZE }, () => ({
  umaName: '',
  distance: DISTANCE_ORDER[0],
  points: '',
}))

function blankDraft() {
  return { rows: BLANK_ROWS, source: 'manual', warnings: [] }
}

// OCR rows are left in the screenshots' own points-descending order (not run
// through sortRows) so the grid reads in the same order as the source
// screenshots, making it easier to fact-check row-by-row against the phone.
// A null distance (mergeScreenshotRows couldn't resolve it) is coalesced to
// a valid <select> value here; the pushed warning is what tells the user to
// double-check that row rather than trusting the placeholder silently.
function toOcrGridRows(mergedRows, warnings) {
  const rows = mergedRows.map((row) => ({
    umaName: row.umaName,
    distance: row.distance ?? DISTANCE_ORDER[0],
    points: String(row.points),
  }))

  if (rows.length > ROSTER_SIZE) {
    warnings.push(
      `Found ${rows.length} rows, expected ${ROSTER_SIZE} — the extra rows were dropped.`
    )
    rows.length = ROSTER_SIZE
  } else if (rows.length < ROSTER_SIZE) {
    warnings.push(
      `Found ${rows.length} rows, expected ${ROSTER_SIZE} — the missing rows were left blank, please fill them in.`
    )
  }

  return padToRosterSize(rows)
}

function padToRosterSize(rows) {
  const padded = [...rows]
  while (padded.length < ROSTER_SIZE) {
    padded.push({ umaName: '', distance: DISTANCE_ORDER[0], points: '' })
  }
  return padded
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const distanceDiff = DISTANCE_ORDER.indexOf(a.distance) - DISTANCE_ORDER.indexOf(b.distance)
    if (distanceDiff !== 0) return distanceDiff
    return a.umaName.localeCompare(b.umaName)
  })
}

function toLocalDatetimeValue(date) {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

// Splits an ordered file list into per-match groups of 2 (top screenshot,
// then bottom), trusting upload order since there's no reorder UI. A
// trailing odd file becomes its own group of 1, matching the existing
// single-screenshot fallback (no merge, no distance-pairing help from a
// second screenshot).
function chunkIntoPairs(files) {
  const chunks = []
  for (let i = 0; i < files.length; i += 2) {
    chunks.push(files.slice(i, i + 2))
  }
  return chunks
}

async function buildDraftFromScreenshots(files) {
  const recognized = await Promise.all(files.map((file) => recognizeImage(file)))

  if (recognized.length === 1) {
    const rows = parseScreenshotRows(recognized[0].lines)
    return { rows: toOcrGridRows(rows, []), source: 'ocr', warnings: [] }
  }

  const [{ lines: linesA }, { lines: linesB }] = recognized
  const rowsA = parseScreenshotRows(linesA)
  const rowsB = parseScreenshotRows(linesB)
  const leadingDistanceForB = findLeadingDistance(linesB)
  const { rows: mergedRows, warnings } = mergeScreenshotRows(rowsA, rowsB, leadingDistanceForB)

  return { rows: toOcrGridRows(mergedRows, warnings), source: 'ocr', warnings }
}

function MatchEntryForm() {
  const [matches, setMatches] = useState([blankDraft()])
  const [playedAt, setPlayedAt] = useState(() => toLocalDatetimeValue(new Date()))
  const [error, setError] = useState('')

  const [ocrStatus, setOcrStatus] = useState('idle')
  const [ocrError, setOcrError] = useState('')
  const fileInputRef = useRef(null)

  const fetchPrefillRows = () =>
    getLatestMatchEntries().then((latestEntries) => {
      if (latestEntries.length === 0) return BLANK_ROWS
      return padToRosterSize(
        sortRows(
          latestEntries.map((entry) => ({
            umaName: entry.umaName,
            distance: entry.distance,
            points: '',
          }))
        )
      )
    })

  useEffect(() => {
    let ignore = false
    fetchPrefillRows().then((prefilled) => {
      if (!ignore) setMatches([{ rows: prefilled, source: 'manual', warnings: [] }])
    })
    return () => {
      ignore = true
    }
  }, [])

  const updateRow = (matchIndex, rowIndex, field, value) => {
    setMatches((prev) =>
      prev.map((match, mi) =>
        mi !== matchIndex
          ? match
          : {
              ...match,
              rows: match.rows.map((row, ri) => (ri === rowIndex ? { ...row, [field]: value } : row)),
            }
      )
    )
  }

  const handleScreenshotUpload = async (event) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    if (files.length > MAX_SCREENSHOTS_PER_BATCH) {
      setOcrStatus('error')
      setOcrError(`Upload at most ${MAX_SCREENSHOTS_PER_BATCH} screenshots at a time.`)
      return
    }

    const validationError = files.map(validateScreenshotFile).find(Boolean)
    if (validationError) {
      setOcrStatus('error')
      setOcrError(validationError)
      return
    }

    setOcrStatus('processing')
    setOcrError('')

    try {
      const drafts = await Promise.all(chunkIntoPairs(files).map(buildDraftFromScreenshots))
      setMatches(drafts)
      setOcrStatus('idle')
    } catch {
      setOcrStatus('error')
      setOcrError('OCR failed — you can still enter rows manually below.')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const label = (matchIndex) => (matches.length > 1 ? `Match ${matchIndex + 1}: ` : '')

    const drafts = matches
      .map((match, matchIndex) => ({
        matchIndex,
        source: match.source,
        filledRows: match.rows.filter((row) => row.umaName.trim() !== ''),
      }))
      .filter((draft) => draft.filledRows.length > 0)

    if (drafts.length === 0) {
      setError('Enter at least one uma before saving.')
      return
    }

    for (const { matchIndex, filledRows } of drafts) {
      const names = filledRows.map((row) => row.umaName.trim().toLowerCase())
      const hasDuplicate = names.some((name, i) => names.indexOf(name) !== i)
      if (hasDuplicate) {
        setError(`${label(matchIndex)}Two rows have the same uma name — each uma must be unique in a match.`)
        return
      }

      for (const row of filledRows) {
        const points = Number(row.points)
        if (!Number.isInteger(points) || points <= 0) {
          setError(`${label(matchIndex)}${row.umaName.trim()}: points must be a positive whole number.`)
          return
        }
      }
    }

    const playedAtIso = new Date(playedAt).toISOString()
    for (const { source, filledRows } of drafts) {
      await addMatch({
        playedAt: playedAtIso,
        rows: filledRows.map((row) => ({
          umaName: row.umaName.trim(),
          distance: row.distance,
          points: Number(row.points),
        })),
        source,
      })
    }

    setPlayedAt(toLocalDatetimeValue(new Date()))
    setMatches([{ rows: await fetchPrefillRows(), source: 'manual', warnings: [] }])
    setOcrStatus('idle')
    setOcrError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <section id="match-entry-form">
      <h2>Log a match</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="played-at">Match date</label>
        <input
          id="played-at"
          type="datetime-local"
          value={playedAt}
          onChange={(event) => setPlayedAt(event.target.value)}
        />

        <div className="ocr-upload">
          <label htmlFor="score-info-upload">
            Upload Score Info screenshots for one or more matches — select them in order, two per
            match (top screenshot, then bottom), oldest match first
          </label>
          <input
            id="score-info-upload"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={ocrStatus === 'processing'}
            onChange={handleScreenshotUpload}
          />
          {ocrStatus === 'processing' && <p>Reading screenshots…</p>}
          {ocrError && <p className="form-error">{ocrError}</p>}
        </div>

        {matches.map((match, matchIndex) => (
          <fieldset key={matchIndex}>
            {matches.length > 1 && <legend>Match {matchIndex + 1}</legend>}

            {match.warnings.length > 0 && (
              <ul className="ocr-warnings">
                {match.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}

            <table>
              <thead>
                <tr>
                  <th>Uma</th>
                  <th>Distance</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {match.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td>
                      <input
                        type="text"
                        value={row.umaName}
                        onChange={(event) => updateRow(matchIndex, rowIndex, 'umaName', event.target.value)}
                        placeholder="Uma name"
                      />
                    </td>
                    <td>
                      <select
                        value={row.distance}
                        onChange={(event) => updateRow(matchIndex, rowIndex, 'distance', event.target.value)}
                      >
                        {DISTANCE_ORDER.map((distance) => (
                          <option key={distance} value={distance}>
                            {distance}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={row.points}
                        onChange={(event) => updateRow(matchIndex, rowIndex, 'points', event.target.value)}
                        placeholder="Points"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </fieldset>
        ))}

        {error && <p className="form-error">{error}</p>}

        <button type="submit" disabled={ocrStatus === 'processing'}>
          {matches.length > 1 ? `Save ${matches.length} matches` : 'Save match'}
        </button>
      </form>
    </section>
  )
}

export default MatchEntryForm
