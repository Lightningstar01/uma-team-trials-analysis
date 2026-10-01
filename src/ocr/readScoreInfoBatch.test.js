import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./tesseractClient.js', () => ({ recognizeImage: vi.fn() }))

const { recognizeImage } = await import('./tesseractClient.js')
const { chunkIntoPairs, readScoreInfoBatch, MAX_SCREENSHOTS_PER_BATCH } = await import(
  './readScoreInfoBatch.js'
)

function makeFile(name, type = 'image/jpeg') {
  return { name, type, size: 1000 }
}

beforeEach(() => {
  recognizeImage.mockReset()
  recognizeImage.mockResolvedValue({ text: '', lines: [] })
})

describe('chunkIntoPairs', () => {
  it('groups files two at a time in upload order', () => {
    expect(chunkIntoPairs(['a', 'b', 'c', 'd'])).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('leaves a trailing odd file as its own group', () => {
    expect(chunkIntoPairs(['a', 'b', 'c'])).toEqual([['a', 'b'], ['c']])
  })
})

describe('readScoreInfoBatch', () => {
  it('returns one { rows, warnings } result per match pair', async () => {
    const files = ['1a', '1b', '2a', '2b'].map((n) => makeFile(`${n}.jpg`))
    const result = await readScoreInfoBatch(files)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ rows: [], warnings: expect.any(Array) })
    expect(recognizeImage).toHaveBeenCalledTimes(4)
  })

  it('rejects an unsupported file type without running OCR', async () => {
    await expect(readScoreInfoBatch([makeFile('notes.txt', 'text/plain')])).rejects.toThrow(
      'notes.txt: not a supported image type'
    )
    expect(recognizeImage).not.toHaveBeenCalled()
  })

  it('rejects a batch over the screenshot cap without running OCR', async () => {
    const files = Array.from({ length: MAX_SCREENSHOTS_PER_BATCH + 1 }, (_, i) => makeFile(`${i}.jpg`))
    await expect(readScoreInfoBatch(files)).rejects.toThrow(
      `Upload at most ${MAX_SCREENSHOTS_PER_BATCH} screenshots at a time.`
    )
    expect(recognizeImage).not.toHaveBeenCalled()
  })

  it('replaces an OCR failure with a user-facing message', async () => {
    recognizeImage.mockRejectedValue(new Error('worker crashed'))
    await expect(readScoreInfoBatch([makeFile('a.jpg')])).rejects.toThrow('OCR failed')
  })
})
