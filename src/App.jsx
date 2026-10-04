import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getRoster } from './db/roster'
import { requestPersistentStorage } from './db/storage'
import { UMA_NAMES } from './ocr/umaNames'
import { readScoreInfoBatch } from './ocr/readScoreInfoBatch'
import RosterSetup from './components/RosterSetup'
import RosterDashboard from './components/RosterDashboard'
import MatchHistory from './components/MatchHistory'
import MatchEntryModal from './components/MatchEntryModal'
import BackupCard from './components/BackupCard'
import './App.css'

function App() {
  const roster = useLiveQuery(getRoster)
  // { id, kind: 'manual' } | { id, kind: 'screenshots', pending } | null,
  // where `pending` is the readScoreInfoBatch promise.
  // `id` remounts the modal so each open starts from fresh state.
  const [entryRequest, setEntryRequest] = useState(null)
  const fileInputRef = useRef(null)
  // 'persisted' | 'not-persisted' | 'unsupported', or null until asked.
  const [storageStatus, setStorageStatus] = useState(null)
  const hasRoster = roster !== undefined && roster.length > 0

  // Ask once there's data worth keeping (a roster saved by any path,
  // including import), so Firefox's permission prompt has a reason behind it.
  useEffect(() => {
    if (!hasRoster) return
    let cancelled = false
    requestPersistentStorage()
      .catch(() => 'unsupported')
      .then((status) => {
        if (!cancelled) setStorageStatus(status)
      })
    return () => {
      cancelled = true
    }
  }, [hasRoster])

  const openScreenshotPicker = () => fileInputRef.current?.click()

  // OCR starts here, in the event handler, rather than in the modal's
  // effect - so a dev-mode StrictMode effect re-run can't read the batch twice.
  const handleFilesChosen = (event) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    const pending = readScoreInfoBatch(files)
    // The modal reports the failure; this only stops an "unhandled
    // rejection" warning before the modal has subscribed.
    pending.catch(() => {})
    setEntryRequest({ id: Date.now(), kind: 'screenshots', pending })
  }

  return (
    <>
      <header className="app-header">
        <h1>Uma Team Trials Score Auditor</h1>
        <p className="tagline">Track every uma's Team Trials scores and find who to upgrade next.</p>
      </header>

      <main>
        {roster !== undefined && roster.length === 0 && (
          <RosterSetup onAutoFill={openScreenshotPicker} />
        )}

        {hasRoster && (
          <>
            <RosterDashboard />
            <section className="card log-match">
              <div>
                <h2>Log a match</h2>
                <p className="hint">
                  Screenshots: select two Score Info screenshots per match (top, then bottom), oldest
                  match first.
                </p>
              </div>
              <div className="button-row">
                <button type="button" className="btn btn-primary" onClick={openScreenshotPicker}>
                  Upload screenshots
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setEntryRequest({ id: Date.now(), kind: 'manual' })}
                >
                  Enter manually
                </button>
              </div>
            </section>
            <MatchHistory />
            <BackupCard storageStatus={storageStatus} />
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Scores are each uma&apos;s Gained Score from the Score Info screen. The Team Bonus (shown only on
          Score Details) isn&apos;t included in any average.
        </p>
        <p>
          Your data is stored only in this browser, and screenshots never leave your device. Export a backup
          to keep it safe or move it to another device.
        </p>
      </footer>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={handleFilesChosen}
      />

      <datalist id="uma-names">
        {UMA_NAMES.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {entryRequest && roster && (
        <MatchEntryModal
          key={entryRequest.id}
          request={entryRequest}
          roster={roster}
          onClose={() => setEntryRequest(null)}
        />
      )}
    </>
  )
}

export default App
