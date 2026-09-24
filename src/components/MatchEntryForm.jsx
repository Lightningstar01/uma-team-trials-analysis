import { useEffect, useRef, useState } from 'react'
import { DISTANCE_ORDER } from '../db/constants'
import { addMatch, getLatestMatchEntries } from '../db/matches'
import { validateScreenshotFile } from '../ocr/imageValidation'
import { recognizeImage } from '../ocr/tesseractClient'
import { parseScreenshotRows, mergeScreenshotRows } from '../ocr/parseScoreInfo'

const ROSTER_SIZE = 15
const MAX_SCREENSHOTS = 2

const BLANK_ROWS = Array.from({ length: ROSTER_SIZE }, () => ({
  umaName: '',
  distance: DISTANCE_ORDER[0],
  points: '',
}))

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
  }

  while (rows.length < ROSTER_SIZE) {
    rows.push({ umaName: '', distance: DISTANCE_ORDER[0], points: '' })
  }

  return rows
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

function MatchEntryForm() {
  const [rows, setRows] = useState(BLANK_ROWS)
  const [playedAt, setPlayedAt] = useState(() => toLocalDatetimeValue(new Date()))
  const [error, setError] = useState('')

  const [source, setSource] = useState('manual')
  const [ocrStatus, setOcrStatus] = useState('idle')
  const [ocrWarnings, setOcrWarnings] = useState([])
  const [ocrError, setOcrError] = useState('')
  const fileInputRef = useRef(null)

  const fetchPrefillRows = () =>
    getLatestMatchEntries().then((latestEntries) => {
      if (latestEntries.length === 0) return BLANK_ROWS
      return sortRows(
        latestEntries.map((entry) => ({
          umaName: entry.umaName,
          distance: entry.distance,
          points: '',
        }))
      )
    })

  useEffect(() => {
    let ignore = false
    fetchPrefillRows().then((prefilled) => {
      if (!ignore) setRows(prefilled)
    })
    return () => {
      ignore = true
    }
  }, [])

  const updateRow = (index, field, value) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  const handleScreenshotUpload = async (event) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    if (files.length > MAX_SCREENSHOTS) {
      setOcrStatus('error')
      setOcrError(`Upload at most ${MAX_SCREENSHOTS} screenshots at a time.`)
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
    setOcrWarnings([])

    try {
      const parsedRows = []
      for (const file of files) {
        const { lines } = await recognizeImage(file)
        parsedRows.push(parseScreenshotRows(lines))
      }

      const { rows: mergedRows, warnings } =
        parsedRows.length === 2
          ? mergeScreenshotRows(parsedRows[0], parsedRows[1])
          : { rows: parsedRows[0], warnings: [] }

      setRows(toOcrGridRows(mergedRows, warnings))
      setSource('ocr')
      setOcrWarnings(warnings)
      setOcrStatus('idle')
    } catch {
      setOcrStatus('error')
      setOcrError('OCR failed — you can still enter rows manually below.')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const filledRows = rows.filter((row) => row.umaName.trim() !== '')

    if (filledRows.length === 0) {
      setError('Enter at least one uma before saving.')
      return
    }

    const names = filledRows.map((row) => row.umaName.trim().toLowerCase())
    const hasDuplicate = names.some((name, i) => names.indexOf(name) !== i)
    if (hasDuplicate) {
      setError('Two rows have the same uma name — each uma must be unique in a match.')
      return
    }

    for (const row of filledRows) {
      const points = Number(row.points)
      if (!Number.isInteger(points) || points <= 0) {
        setError(`${row.umaName.trim()}: points must be a positive whole number.`)
        return
      }
    }

    await addMatch({
      playedAt: new Date(playedAt).toISOString(),
      rows: filledRows.map((row) => ({
        umaName: row.umaName.trim(),
        distance: row.distance,
        points: Number(row.points),
      })),
      source,
    })

    setPlayedAt(toLocalDatetimeValue(new Date()))
    setRows(await fetchPrefillRows())
    setSource('manual')
    setOcrStatus('idle')
    setOcrWarnings([])
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
            Upload 1–2 Score Info screenshots to auto-fill the rows below
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
          {ocrWarnings.length > 0 && (
            <ul className="ocr-warnings">
              {ocrWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>

        <table>
          <thead>
            <tr>
              <th>Uma</th>
              <th>Distance</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="text"
                    value={row.umaName}
                    onChange={(event) => updateRow(index, 'umaName', event.target.value)}
                    placeholder="Uma name"
                  />
                </td>
                <td>
                  <select
                    value={row.distance}
                    onChange={(event) => updateRow(index, 'distance', event.target.value)}
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
                    onChange={(event) => updateRow(index, 'points', event.target.value)}
                    placeholder="Points"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" disabled={ocrStatus === 'processing'}>
          Save match
        </button>
      </form>
    </section>
  )
}

export default MatchEntryForm
