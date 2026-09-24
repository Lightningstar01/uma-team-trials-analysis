import { useEffect, useState } from 'react'
import { DISTANCE_ORDER } from '../db/constants'
import { addMatch, getLatestMatchEntries } from '../db/matches'

const BLANK_ROWS = Array.from({ length: 15 }, () => ({
  umaName: '',
  distance: DISTANCE_ORDER[0],
  points: '',
}))

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
    })

    setPlayedAt(toLocalDatetimeValue(new Date()))
    setRows(await fetchPrefillRows())
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

        <button type="submit">Save match</button>
      </form>
    </section>
  )
}

export default MatchEntryForm
