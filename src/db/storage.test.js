import { describe, it, expect, vi } from 'vitest'
import { requestPersistentStorage } from './storage.js'

describe('requestPersistentStorage', () => {
  it('is unsupported without a StorageManager', async () => {
    expect(await requestPersistentStorage(undefined)).toBe('unsupported')
    expect(await requestPersistentStorage({})).toBe('unsupported')
  })

  it('does not ask again when storage is already persisted', async () => {
    const storage = { persisted: async () => true, persist: vi.fn() }
    expect(await requestPersistentStorage(storage)).toBe('persisted')
    expect(storage.persist).not.toHaveBeenCalled()
  })

  it('reports a granted request', async () => {
    const storage = { persisted: async () => false, persist: async () => true }
    expect(await requestPersistentStorage(storage)).toBe('persisted')
  })

  it('reports a denied request', async () => {
    const storage = { persisted: async () => false, persist: async () => false }
    expect(await requestPersistentStorage(storage)).toBe('not-persisted')
  })
})
