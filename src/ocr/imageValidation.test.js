import { describe, it, expect } from 'vitest'
import { validateScreenshotFile } from './imageValidation.js'

const ONE_MB = 1024 * 1024

function makeFile({ name = 'screenshot.jpg', type = 'image/jpeg', size = ONE_MB } = {}) {
  return { name, type, size }
}

describe('validateScreenshotFile', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s under the size cap', (type) => {
    expect(validateScreenshotFile(makeFile({ type }))).toBeNull()
  })

  it('rejects an unsupported MIME type', () => {
    const file = makeFile({ name: 'screenshot.gif', type: 'image/gif' })
    expect(validateScreenshotFile(file)).toBe('screenshot.gif: not a supported image type (jpg, png, webp).')
  })

  it('rejects a file one byte over the 15 MB cap', () => {
    const file = makeFile({ size: 15 * ONE_MB + 1 })
    expect(validateScreenshotFile(file)).toBe('screenshot.jpg: file is too large (max 15 MB).')
  })

  it('accepts a file at exactly the 15 MB cap', () => {
    const file = makeFile({ size: 15 * ONE_MB })
    expect(validateScreenshotFile(file)).toBeNull()
  })

  it('reports the type error when both the type and size are invalid', () => {
    const file = makeFile({ name: 'screenshot.gif', type: 'image/gif', size: 15 * ONE_MB + 1 })
    expect(validateScreenshotFile(file)).toBe('screenshot.gif: not a supported image type (jpg, png, webp).')
  })
})
