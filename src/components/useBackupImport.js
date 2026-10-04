import { useRef, useState } from 'react'
import { importBackup, parseBackupText, validateBackup } from '../db/backup'
import { formatPlayedAt } from './format'

const MAX_ERRORS_SHOWN = 5

// Shared import flow for the Backup card and the setup screen: pick a file,
// check it, optionally confirm replacing current data, then import.
// Spread `inputProps` onto a hidden <input> and call `chooseFile` from a button.
export function useBackupImport({ confirmReplace }) {
  const inputRef = useRef(null)
  const [errors, setErrors] = useState([])
  const [imported, setImported] = useState(false)

  const handleFileChosen = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setErrors([])
    setImported(false)

    try {
      const data = parseBackupText(await file.text())
      const problems = validateBackup(data)
      if (problems.length > 0) {
        const extra = problems.length - MAX_ERRORS_SHOWN
        setErrors([
          ...problems.slice(0, MAX_ERRORS_SHOWN),
          ...(extra > 0 ? [`…and ${extra} more problems.`] : []),
        ])
        return
      }

      const exported = data.exportedAt ? `, exported ${formatPlayedAt(data.exportedAt)}` : ''
      if (
        confirmReplace &&
        !window.confirm(
          `Replace your roster and every logged match with this backup (${data.matches.length} matches${exported})? ` +
            "Your current data will be deleted, so export it first if you might want it. This can't be undone."
        )
      ) {
        return
      }

      await importBackup(data)
      setImported(true)
    } catch (error) {
      setErrors([error.message])
    }
  }

  return {
    chooseFile: () => inputRef.current?.click(),
    inputProps: {
      ref: inputRef,
      type: 'file',
      accept: 'application/json,.json',
      hidden: true,
      onChange: handleFileChosen,
    },
    errors,
    imported,
  }
}
