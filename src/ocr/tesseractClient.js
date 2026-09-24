// Thin wrapper around Tesseract.js's worker lifecycle. Imported dynamically by
// callers (never at module load time) so Tesseract's JS/wasm/lang-data are
// code-split out of the main bundle and only fetched once a screenshot is
// actually uploaded.

let workerPromise = null

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      return createWorker('eng')
    })()
  }
  return workerPromise
}

// Tesseract only returns line/word-level bounding boxes when `blocks` output
// is requested, nested as blocks -> paragraphs -> lines -> words. Flatten
// that into a single list of { text, bbox, words } for the row-band parser.
// Word-level bboxes matter because a recognized line's text often has OCR
// noise from the portrait/badge art mixed in before the real name (see
// docs/decisions.md) — isolating the name by each word's x-position is far
// more reliable than trying to strip that noise out of the line's raw text.
function flattenLines(page) {
  const lines = []
  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        lines.push({
          text: line.text,
          bbox: line.bbox,
          words: (line.words ?? []).map((word) => ({ text: word.text, bbox: word.bbox })),
        })
      }
    }
  }
  return lines
}

export async function recognizeImage(fileOrBlob) {
  const worker = await getWorker()
  const { data } = await worker.recognize(fileOrBlob, {}, { text: true, blocks: true })
  return {
    text: data.text,
    lines: flattenLines(data),
  }
}

export async function terminateWorker() {
  if (!workerPromise) return
  const worker = await workerPromise
  await worker.terminate()
  workerPromise = null
}
