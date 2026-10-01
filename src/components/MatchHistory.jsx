import { useLiveQuery } from 'dexie-react-hooks'
import { deleteMatch, getMatchHistory } from '../db/matches'
import { formatPlayedAt } from './format'

function MatchHistory() {
  const matches = useLiveQuery(getMatchHistory, [], [])

  const handleDelete = async (match) => {
    const confirmed = window.confirm(
      `Delete the match from ${formatPlayedAt(match.playedAt)}? All ${match.entryCount} of its ` +
        "scores will be removed. This can't be undone."
    )
    if (!confirmed) return
    await deleteMatch(match.matchId)
  }

  return (
    <section className="card">
      <details className="match-history">
        <summary>
          <h2>Match history</h2>
          <span className="muted">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'}
          </span>
        </summary>

        {matches.length === 0 ? (
          <p className="muted">No matches logged yet.</p>
        ) : (
          <ul className="history-list">
            {matches.map((match) => (
              <li key={match.matchId}>
                <span>{formatPlayedAt(match.playedAt)}</span>
                <span className="muted">
                  {match.source === 'ocr' ? 'Screenshots' : 'Manual'} · {match.entryCount} umas
                </span>
                <button type="button" className="btn btn-small btn-danger" onClick={() => handleDelete(match)}>
                  Delete match
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  )
}

export default MatchHistory
