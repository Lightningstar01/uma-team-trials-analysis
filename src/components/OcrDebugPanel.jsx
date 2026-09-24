import { useState } from 'react'
import { validateScreenshotFile } from '../ocr/imageValidation'
import { recognizeImage } from '../ocr/tesseractClient'

// Dev-only diagnostic tool for sub-chunk 2a: confirms Tesseract.js can read
// real Score Info screenshots client-side before 2b/2c build structured
// parsing on top of it. Mounted only in dev builds (see App.jsx).
function OcrDebugPanel() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [results, setResults] = useState([])

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    setError('')
    setResults([])

    for (const file of files) {
      const validationError = validateScreenshotFile(file)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    setStatus('processing')
    try {
      const next = []
      for (const file of files) {
        const { text, lines } = await recognizeImage(file)
        next.push({ name: file.name, text, lineCount: lines.length })
      }
      setResults(next)
      setStatus('idle')
    } catch (err) {
      setError(err.message ?? 'OCR failed.')
      setStatus('error')
    }
  }

  return (
    <section id="ocr-debug-panel">
      <h2>OCR debug panel (dev only)</h2>
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFiles} />
      {status === 'processing' && <p>Reading screenshots…</p>}
      {error && <p className="form-error">{error}</p>}
      {results.map((result) => (
        <div key={result.name}>
          <h3>
            {result.name} ({result.lineCount} lines)
          </h3>
          <pre>{result.text}</pre>
        </div>
      ))}
    </section>
  )
}

export default OcrDebugPanel
