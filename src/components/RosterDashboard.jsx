import { Fragment, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { DISTANCE_ORDER } from '../db/constants'
import { deleteUmaScores, findWeakestLink, getRosterStats } from '../db/matches'
import { resetRoster, updateRosterSlot } from '../db/roster'
import { validateRows } from '../ocr/parseScoreInfo'
import { formatPlayedAt, formatPoints } from './format'
import { nextSort, sortRosterStats } from './rosterSort'

const SORTABLE_COLUMNS = [
  { key: 'umaName', label: 'Uma' },
  { key: 'distance', label: 'Distance' },
  { key: 'average', label: 'Average', numeric: true },
  { key: 'high', label: 'High', numeric: true },
  { key: 'low', label: 'Low', numeric: true },
  { key: 'matchCount', label: 'Matches', numeric: true },
]
const COLUMN_COUNT = SORTABLE_COLUMNS.length + 1

function RosterDashboard() {
  const stats = useLiveQuery(getRosterStats, [], [])
  const [sort, setSort] = useState({ key: 'distance', direction: 'asc' })
  const [expandedId, setExpandedId] = useState(null)
  const [editing, setEditing] = useState(null) // { id, umaName, distance, error }

  const weakestId = findWeakestLink(stats)
  const rosterWarnings = validateRows(stats.map((slot) => ({ ...slot, points: '' })))

  const handleDeleteScores = async (slot) => {
    const confirmed = window.confirm(
      `Delete all ${slot.matchCount} scores for ${slot.umaName}? The roster slot stays, so you can ` +
        "edit it afterwards. This can't be undone."
    )
    if (!confirmed) return
    await deleteUmaScores(slot.id)
  }

  const handleReset = async () => {
    const confirmed = window.confirm(
      'Reset the roster? This deletes all 15 umas and every logged match and score, so you can start ' +
        "from scratch. This can't be undone."
    )
    if (!confirmed) return
    await resetRoster()
  }

  const handleSaveEdit = async () => {
    try {
      await updateRosterSlot(editing.id, editing)
      setEditing(null)
    } catch (error) {
      setEditing((prev) => ({ ...prev, error: error.message }))
    }
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>Roster</h2>
          <p className="hint">
            Click an uma to see every score, or a column name to sort. Simple Mode: raw averages over all
            history.
          </p>
        </div>
        <button type="button" className="btn btn-small btn-danger" onClick={handleReset}>
          Reset roster
        </button>
      </div>

      {rosterWarnings.length > 0 && (
        <ul className="warnings">
          {rosterWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <div className="table-scroll">
        <table className="roster-table">
          <thead>
            <tr>
              {SORTABLE_COLUMNS.map((column) => {
                const isActive = sort.key === column.key
                const ariaSort = isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                return (
                  <th key={column.key} className={column.numeric ? 'num' : undefined} aria-sort={ariaSort}>
                    <button
                      type="button"
                      className={`sort-button${isActive ? ' active' : ''}`}
                      onClick={() => setSort((prev) => nextSort(prev, column.key))}
                    >
                      {column.label}
                      <span className="sort-arrow" aria-hidden="true">
                        {isActive ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                )
              })}
              <th aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {sortRosterStats(stats, sort).map((slot) => {
              const isEditing = editing?.id === slot.id
              const isExpanded = expandedId === slot.id
              return (
                <Fragment key={slot.id}>
                  <tr className={slot.id === weakestId ? 'weakest-link' : undefined}>
                    {isEditing ? (
                      <>
                        <td>
                          <input
                            type="text"
                            list="uma-names"
                            value={editing.umaName}
                            onChange={(event) =>
                              setEditing((prev) => ({ ...prev, umaName: event.target.value }))
                            }
                            aria-label="Uma name"
                          />
                        </td>
                        <td>
                          <select
                            value={editing.distance}
                            onChange={(event) =>
                              setEditing((prev) => ({ ...prev, distance: event.target.value }))
                            }
                            aria-label="Distance"
                          >
                            {DISTANCE_ORDER.map((distance) => (
                              <option key={distance}>{distance}</option>
                            ))}
                          </select>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          <button
                            type="button"
                            className="expand"
                            aria-expanded={isExpanded}
                            onClick={() => setExpandedId(isExpanded ? null : slot.id)}
                          >
                            <span className="chevron" aria-hidden="true">
                              ▸
                            </span>
                            {slot.umaName}
                          </button>
                          {slot.id === weakestId && <span className="badge">Upgrade next</span>}
                        </td>
                        <td>
                          <span className={`distance distance-${slot.distance.toLowerCase()}`}>
                            {slot.distance}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="num">{formatPoints(slot.average)}</td>
                    <td className="num">{formatPoints(slot.high)}</td>
                    <td className="num">{formatPoints(slot.low)}</td>
                    <td className="num">{slot.matchCount}</td>
                    <td className="actions">
                      {isEditing ? (
                        <>
                          <button type="button" className="btn btn-small btn-primary" onClick={handleSaveEdit}>
                            Save
                          </button>
                          <button type="button" className="btn btn-small" onClick={() => setEditing(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-small"
                            disabled={slot.matchCount > 0}
                            title={slot.matchCount > 0 ? "Delete this uma's scores before editing it" : undefined}
                            onClick={() =>
                              setEditing({ id: slot.id, umaName: slot.umaName, distance: slot.distance, error: '' })
                            }
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-small btn-danger"
                            disabled={slot.matchCount === 0}
                            onClick={() => handleDeleteScores(slot)}
                          >
                            Delete scores
                          </button>
                        </>
                      )}
                    </td>
                  </tr>

                  {isEditing && editing.error && (
                    <tr className="detail-row">
                      <td colSpan={COLUMN_COUNT} className="error-text">
                        {editing.error}
                      </td>
                    </tr>
                  )}

                  {isExpanded && !isEditing && (
                    <tr className="detail-row">
                      <td colSpan={COLUMN_COUNT}>
                        {slot.scores.length === 0 ? (
                          <p className="muted">No scores logged yet.</p>
                        ) : (
                          <ul className="score-list">
                            {slot.scores.map((score) => (
                              <li key={score.matchId}>
                                <span className="muted">{formatPlayedAt(score.playedAt)}</span>
                                <strong>{formatPoints(score.points)}</strong>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default RosterDashboard
