/**
 * Reviews historically stored WebP bytes as bare base64 in `photo_data`.
 * Newer uploads may be JPEG when the browser cannot encode WebP, so inspect
 * the file signature before creating the data URL. This keeps old reviews
 * compatible and avoids requiring a database migration.
 */
export function getReviewPhotoDataUrl(base64: string | null | undefined): string | undefined {
  if (!base64) return undefined
  const value = base64.replace(/\s/g, '')
  if (!value) return undefined

  let mimeType = 'image/webp' // Backward-compatible default for existing records.
  if (value.startsWith('/9j/')) mimeType = 'image/jpeg'
  else if (value.startsWith('iVBORw0KGgo')) mimeType = 'image/png'
  else if (value.startsWith('R0lGOD')) mimeType = 'image/gif'
  else if (value.startsWith('UklGR')) mimeType = 'image/webp'

  return `data:${mimeType};base64,${value}`
}
