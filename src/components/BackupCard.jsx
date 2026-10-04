import { useState } from 'react'
import { backupFileName, exportBackup } from '../db/backup'
import { useBackupImport } from './useBackupImport'

function BackupCard({ storageStatus }) {
  const backupImport = useBackupImport({ confirmReplace: true })
  const [exportError, setExportError] = useState('')

  const handleExport = async () => {
    setExportError('')
    try {
      const backup = await exportBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = backupFileName(new Date())
      link.click()
      // Deferred so the download has started before the URL goes away.
      setTimeout(() => URL.revokeObjectURL(url))
    } catch (error) {
      setExportError(error.message)
    }
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>Backup</h2>
          <p className="hint">
            Your data is stored only in this browser. Export a backup file regularly; import it to restore
            or move to another device. Importing replaces everything currently in the app.
          </p>
          {storageStatus === 'not-persisted' && (
            <p className="hint">
              This browser hasn&apos;t granted persistent storage, so it may clear your data if the device
              runs low on space. Export often.
            </p>
          )}
        </div>
        <div className="button-row">
          <button type="button" className="btn btn-primary" onClick={handleExport}>
            Export backup
          </button>
          <button type="button" className="btn" onClick={backupImport.chooseFile}>
            Import backup
          </button>
        </div>
      </div>

      <input {...backupImport.inputProps} />
      {backupImport.imported && <p className="muted">Backup imported.</p>}
      {(exportError || backupImport.errors.length > 0) && (
        <ul className="errors">
          {exportError && <li>{exportError}</li>}
          {backupImport.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default BackupCard
