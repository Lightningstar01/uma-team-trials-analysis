import { useState } from 'react'
import { DISTANCE_ORDER, ROSTER_SIZE } from '../db/constants'
import { createRoster, validateRoster } from '../db/roster'
import { validateRows } from '../ocr/parseScoreInfo'
import { useBackupImport } from './useBackupImport'

// Pre-fills 3 slots per distance category, matching the game's fixed shape.
function blankRosterRows() {
  const perDistance = ROSTER_SIZE / DISTANCE_ORDER.length
  return Array.from({ length: ROSTER_SIZE }, (_, i) => ({
    umaName: '',
    distance: DISTANCE_ORDER[Math.floor(i / perDistance)],
  }))
}

function RosterSetup({ onAutoFill }) {
  const [step, setStep] = useState('choose')
  const [rows, setRows] = useState(blankRosterRows)
  const [errors, setErrors] = useState([])
  // Nothing is stored yet on this screen, so there's nothing to confirm replacing.
  const backupImport = useBackupImport({ confirmReplace: false })

  const updateRow = (index, field, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationErrors = validateRoster(rows)
    setErrors(validationErrors)
    if (validationErrors.length > 0) return

    try {
      await createRoster(rows)
    } catch (error) {
      setErrors([error.message])
    }
  }

  if (step === 'choose') {
    return (
      <section className="card setup">
        <h2>Set up your roster</h2>
        <p>
          Add the 15 umas on your Team Trials team. You can type them in, or let the app read them
          from your first Score Info screenshots.
        </p>
        <div className="setup-choices">
          <button type="button" className="choice" onClick={() => setStep('manual')}>
            <strong>Fill roster manually</strong>
            <span>Type each uma's name and distance.</span>
          </button>
          <button type="button" className="choice" onClick={onAutoFill}>
            <strong>Auto-fill from screenshots</strong>
            <span>
              Select two Score Info screenshots per match (top, then bottom). The first match's
              umas become your roster.
            </span>
          </button>
          <button type="button" className="choice" onClick={backupImport.chooseFile}>
            <strong>Import a backup</strong>
            <span>Restore a .json backup exported from this app, with all its matches.</span>
          </button>
        </div>
        <input {...backupImport.inputProps} />
        {backupImport.errors.length > 0 && (
          <ul className="errors setup-errors">
            {backupImport.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </section>
    )
  }

  // Distance-count and dictionary warnings are only meaningful once every
  // name is filled in; before that they'd just nag mid-typing.
  const allNamed = rows.every((row) => row.umaName.trim() !== '')
  const warnings = allNamed ? validateRows(rows.map((row) => ({ ...row, points: '' }))) : []

  return (
    <section className="card setup">
      <h2>Fill your roster</h2>
      <form onSubmit={handleSubmit} className="stack">
        <div className="table-scroll">
          <table className="compact">
            <thead>
              <tr>
                <th>#</th>
                <th>Uma</th>
                <th>Distance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td className="muted">{index + 1}</td>
                  <td>
                    <input
                      type="text"
                      list="uma-names"
                      value={row.umaName}
                      onChange={(event) => updateRow(index, 'umaName', event.target.value)}
                      placeholder="Uma name"
                      aria-label={`Uma ${index + 1} name`}
                    />
                  </td>
                  <td>
                    <select
                      value={row.distance}
                      onChange={(event) => updateRow(index, 'distance', event.target.value)}
                      aria-label={`Uma ${index + 1} distance`}
                    >
                      {DISTANCE_ORDER.map((distance) => (
                        <option key={distance}>{distance}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {warnings.length > 0 && (
          <ul className="warnings">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
        {errors.length > 0 && (
          <ul className="errors">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}

        <div className="button-row">
          <button type="submit" className="btn btn-primary">
            Save roster
          </button>
          <button type="button" className="btn" onClick={() => setStep('choose')}>
            Back
          </button>
        </div>
      </form>
    </section>
  )
}

export default RosterSetup
