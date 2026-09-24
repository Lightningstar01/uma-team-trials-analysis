import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('tesseract.js', () => ({ createWorker: vi.fn() }))

const { createWorker } = await import('tesseract.js')
const { recognizeImage, terminateWorker } = await import('./tesseractClient.js')

function makeMockWorker() {
  return {
    recognize: vi.fn(async () => ({ data: { text: '', blocks: [] } })),
    terminate: vi.fn(async () => {}),
  }
}

beforeEach(() => {
  createWorker.mockReset()
  createWorker.mockImplementation(async () => makeMockWorker())
})

afterEach(async () => {
  await terminateWorker()
})

describe('recognizeImage', () => {
  it('creates an English worker and recognizes the given file with blocks output requested', async () => {
    const file = { name: 'screenshot.jpg' }
    await recognizeImage(file)

    expect(createWorker).toHaveBeenCalledWith('eng')
    const worker = await createWorker.mock.results[0].value
    expect(worker.recognize).toHaveBeenCalledWith(file, {}, { text: true, blocks: true })
  })

  it('reuses the same worker across multiple calls', async () => {
    await recognizeImage({ name: 'a.jpg' })
    await recognizeImage({ name: 'b.jpg' })

    expect(createWorker).toHaveBeenCalledTimes(1)
    const worker = await createWorker.mock.results[0].value
    expect(worker.recognize).toHaveBeenCalledTimes(2)
  })

  it('flattens blocks -> paragraphs -> lines -> words into a single line list', async () => {
    createWorker.mockImplementation(async () => ({
      recognize: vi.fn(async () => ({
        data: {
          text: 'Special Week\nSilence Suzuka\n',
          blocks: [
            {
              paragraphs: [
                {
                  lines: [
                    {
                      text: 'Special Week',
                      bbox: { x0: 0, y0: 0, x1: 10, y1: 10 },
                      words: [{ text: 'Special Week', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } }],
                    },
                  ],
                },
              ],
            },
            {
              paragraphs: [
                {
                  lines: [
                    {
                      text: 'Silence Suzuka',
                      bbox: { x0: 0, y0: 20, x1: 10, y1: 30 },
                      words: [{ text: 'Silence Suzuka', bbox: { x0: 0, y0: 20, x1: 10, y1: 30 } }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      })),
      terminate: vi.fn(async () => {}),
    }))

    const { lines } = await recognizeImage({ name: 'screenshot.jpg' })

    expect(lines).toEqual([
      {
        text: 'Special Week',
        bbox: { x0: 0, y0: 0, x1: 10, y1: 10 },
        words: [{ text: 'Special Week', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } }],
      },
      {
        text: 'Silence Suzuka',
        bbox: { x0: 0, y0: 20, x1: 10, y1: 30 },
        words: [{ text: 'Silence Suzuka', bbox: { x0: 0, y0: 20, x1: 10, y1: 30 } }],
      },
    ])
  })

  it.each([
    ['missing blocks', {}],
    ['a block with no paragraphs', { blocks: [{}] }],
    ['a paragraph with no lines', { blocks: [{ paragraphs: [{}] }] }],
    ['a line with no words', { blocks: [{ paragraphs: [{ lines: [{ text: 'x', bbox: {} }] }] }] }],
  ])('does not throw when the OCR result is missing data (%s)', async (_label, data) => {
    createWorker.mockImplementation(async () => ({
      recognize: vi.fn(async () => ({ data: { text: '', ...data } })),
      terminate: vi.fn(async () => {}),
    }))

    await expect(recognizeImage({ name: 'screenshot.jpg' })).resolves.toBeDefined()
  })
})

describe('terminateWorker', () => {
  it('resolves without error when no worker has been created', async () => {
    await expect(terminateWorker()).resolves.toBeUndefined()
  })

  it('terminates the existing worker and forces a new one to be created next time', async () => {
    await recognizeImage({ name: 'a.jpg' })
    const firstWorker = await createWorker.mock.results[0].value

    await terminateWorker()
    expect(firstWorker.terminate).toHaveBeenCalledTimes(1)

    await recognizeImage({ name: 'b.jpg' })
    expect(createWorker).toHaveBeenCalledTimes(2)
  })
})
