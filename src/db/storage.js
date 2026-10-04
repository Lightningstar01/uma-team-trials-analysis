// Asks the browser not to evict this site's IndexedDB under storage
// pressure. Resolves to 'persisted', 'not-persisted' (the browser said no),
// or 'unsupported'. Checks persisted() first so an already-granted site
// never triggers a permission prompt (Firefox prompts; Chromium decides
// silently). `storage` is injectable for tests.
export async function requestPersistentStorage(storage = globalThis.navigator?.storage) {
  if (typeof storage?.persist !== 'function') return 'unsupported'
  if (await storage.persisted?.()) return 'persisted'
  return (await storage.persist()) ? 'persisted' : 'not-persisted'
}
