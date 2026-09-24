import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { recognizeImage } from './tesseractClient.js'

const fixture1 = fileURLToPath(new URL('./__fixtures__/Score_Info_1a.jpg', import.meta.url))

// Real OCR against a real screenshot: downloads Tesseract's wasm/lang-data on
// first run and can take 10-30+ seconds. Skipped by default so it doesn't
// slow down `npm test`; remove `.skip` locally to re-validate the pipeline
// against the actual fixture.
describe.skip('tesseractClient (real OCR, slow — run manually)', () => {
  it(
    'recognizes text from Score_Info_1a.jpg',
    async () => {
      const { text } = await recognizeImage(fixture1)
      expect(text).toMatch(/super creek/i)
      expect(text).toMatch(/80,?936/)
    },
    60_000
  )
})
