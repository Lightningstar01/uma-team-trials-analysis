import { validateScreenshotFile } from './imageValidation.js'
import { recognizeImage } from './tesseractClient.js'
import {
  parseScreenshotRows,
  mergeScreenshotRows,
  findLeadingDistance,
  collectNameCorrectionWarnings,
  collectPointsCorrectionWarnings,
  applyBatchRosterFallback,
} from './parseScoreInfo.js'

// Sanity cap on a single upload, not a game-mechanic limit - just a guard
// against an accidental pathological batch (20 matches' worth of pairs).
export const MAX_SCREENSHOTS_PER_BATCH = 40

// Splits an ordered file list into per-match groups of 2 (top screenshot,
// then bottom), trusting upload order since there's no reorder UI. A
// trailing odd file becomes its own group of 1 (no merge, no
// distance-pairing help from a second screenshot).
export function chunkIntoPairs(files) {
  const chunks = []
  for (let i = 0; i < files.length; i += 2) {
    chunks.push(files.slice(i, i + 2))
  }
  return chunks
}

// Returns a match's same-match-merged/inferred rows (a null distance may
// still be present) - the batch-wide roster fallback runs afterwards.
async function buildMergedMatch(files) {
  const recognized = await Promise.all(files.map((file) => recognizeImage(file)))

  if (recognized.length === 1) {
    const rows = parseScreenshotRows(recognized[0].lines)
    const warnings = [...collectNameCorrectionWarnings(rows), ...collectPointsCorrectionWarnings(rows)]
    return { rows, warnings }
  }

  const [{ lines: linesA }, { lines: linesB }] = recognized
  const rowsA = parseScreenshotRows(linesA)
  const rowsB = parseScreenshotRows(linesB)
  const leadingDistanceForB = findLeadingDistance(linesB)
  return mergeScreenshotRows(rowsA, rowsB, leadingDistanceForB)
}

// Reads a batch of Score Info screenshots into one `{ rows, warnings }` per
// match (rows in screenshot order, points as numbers or ''). Rejects with a
// user-facing message: the specific problem for a bad upload, or a generic
// one if OCR itself fails.
export async function readScoreInfoBatch(files) {
  if (files.length > MAX_SCREENSHOTS_PER_BATCH) {
    throw new Error(`Upload at most ${MAX_SCREENSHOTS_PER_BATCH} screenshots at a time.`)
  }
  const validationError = files.map(validateScreenshotFile).find(Boolean)
  if (validationError) throw new Error(validationError)

  let merged
  try {
    merged = await Promise.all(chunkIntoPairs(files).map(buildMergedMatch))
  } catch {
    throw new Error('OCR failed — you can enter the match manually instead.')
  }
  return applyBatchRosterFallback(merged)
}
