import { useLiveQuery } from 'dexie-react-hooks'
import { deleteUmaHistory, getRosterSummary } from '../db/matches'

function RosterDashboard() {
  const roster = useLiveQuery(getRosterSummary, [], [])

  const handleDelete = async (umaName) => {
    const confirmed = window.confirm(
      `Delete all logged history for ${umaName}? This can't be undone.`
    )
    if (!confirmed) return
    await deleteUmaHistory(umaName)
  }

  if (roster.length === 0) {
    return (
      <section id="roster-dashboard">
        <h2>Roster</h2>
        <p>No matches logged yet. Add one below to get started.</p>
      </section>
    )
  }

  return (
    <section id="roster-dashboard">
      <h2>Roster</h2>
      <table>
        <thead>
          <tr>
            <th>Uma</th>
            <th>Distance</th>
            <th>Average</th>
            <th>Matches</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {roster.map((uma, index) => (
            <tr key={uma.umaName} className={index === 0 ? 'weakest-link' : undefined}>
              <td>
                {uma.umaName}
                {index === 0 && <span className="badge">Upgrade next</span>}
              </td>
              <td>{uma.distance}</td>
              <td>{Math.round(uma.average).toLocaleString()}</td>
              <td>{uma.matchCount}</td>
              <td>
                <button type="button" onClick={() => handleDelete(uma.umaName)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default RosterDashboard
