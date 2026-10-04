import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { deleteAllMatches, deleteMatch, deleteOutOfDateMatches, getMatchHistory } from '../db/matches'
import { formatPlayedAt, formatPoints } from './format'
import { keepInPlace } from './keepInPlace'

function MatchHistoryItem({ match }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const activeCount = match.entries.filter((entry) => !entry.deleted).length

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete the match from ${formatPlayedAt(match.playedAt)}? All ${match.entries.length} of its ` +
        "scores will be removed. This can't be undone."
    )
    if (!confirmed) return
    await deleteMatch(match.matchId)
  }

  return (
    <li>
      <div className="history-row">
        <button
          type="button"
          className="expand"
          aria-expanded={isExpanded}
          onClick={(event) => keepInPlace(event.currentTarget, () => setIsExpanded(!isExpanded))}
        >
          <span className="chevron" aria-hidden="true">
            ▸
          </span>
          {formatPlayedAt(match.playedAt)}
        </button>
        <span className="muted">
          {match.source === 'ocr' ? 'Screenshots' : 'Manual'} · {activeCount} umas
          {match.deletedCount > 0 && <span className="badge badge-muted">{match.deletedCount} deleted</span>}
        </span>
        <span className="history-actions">
          {match.deletedCount > 0 && <span className="warning-text">Out of date with current roster</span>}
          <button type="button" className="btn btn-small btn-danger" onClick={handleDelete}>
            Delete match
          </button>
        </span>
      </div>

      {isExpanded && (
        <div className="history-detail">
          <ul className="score-list">
            {match.entries.map((entry) => (
              <li key={entry.entryId} className={entry.deleted ? 'deleted' : undefined}>
                <span className={`distance distance-${entry.distance.toLowerCase()}`}>{entry.distance}</span>
                <span className="uma-name">{entry.umaName}</span>
                <strong>{formatPoints(entry.points)}</strong>
                {entry.deleted && <span className="muted">Deleted</span>}
              </li>
            ))}
          </ul>
          {match.missingCount > 0 && (
            <p className="muted">
              {match.missingCount} earlier deleted {match.missingCount === 1 ? 'uma' : 'umas'} (details not
              kept)
            </p>
          )}
        </div>
      )}
    </li>
  )
}

function MatchHistory() {
  const matches = useLiveQuery(getMatchHistory, [], [])
  const outOfDateCount = matches.filter((match) => match.deletedCount > 0).length

  // These buttons sit inside <summary>; preventDefault stops a click from
  // also toggling the section.
  const handleDeleteOutOfDate = async (event) => {
    event.preventDefault()
    const confirmed = window.confirm(
      `Delete ${outOfDateCount} out-of-date ${outOfDateCount === 1 ? 'match' : 'matches'}? All of ` +
        "their scores will be removed, including the umas still on the roster. This can't be undone."
    )
    if (!confirmed) return
    await deleteOutOfDateMatches()
  }

  const handleDeleteAll = async (event) => {
    event.preventDefault()
    const confirmed = window.confirm(
      `Delete all ${matches.length} ${matches.length === 1 ? 'match' : 'matches'}? Every score is ` +
        "removed, but the roster's umas and distances stay. This can't be undone."
    )
    if (!confirmed) return
    await deleteAllMatches()
  }

  return (
    <section className="card">
      <details className="match-history">
        <summary>
          <h2>Match history</h2>
          <span className="muted">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'}
          </span>
          <span className="summary-actions">
            {outOfDateCount > 0 && (
              <button type="button" className="btn btn-small btn-danger" onClick={handleDeleteOutOfDate}>
                Delete out-of-date matches ({outOfDateCount})
              </button>
            )}
            <button
              type="button"
              className="btn btn-small btn-danger"
              disabled={matches.length === 0}
              onClick={handleDeleteAll}
            >
              Delete all matches
            </button>
          </span>
        </summary>

        {matches.length === 0 ? (
          <p className="muted">No matches logged yet.</p>
        ) : (
          <ul className="history-list">
            {matches.map((match) => (
              <MatchHistoryItem key={match.matchId} match={match} />
            ))}
          </ul>
        )}
      </details>
    </section>
  )
}

export default MatchHistory
