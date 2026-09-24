const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_FILE_BYTES = 15 * 1024 * 1024 // 15 MB

export function validateScreenshotFile(file) {
  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    return `${file.name}: not a supported image type (jpg, png, webp).`
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name}: file is too large (max 15 MB).`
  }
  return null
}
