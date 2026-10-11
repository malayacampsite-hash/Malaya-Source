export function parseSheetRange(range: string) {
  const separator = range.lastIndexOf('!')
  if (separator < 1) throw new Error('GOOGLE_SHEET_RANGE must look like Bookings!A:O.')

  const rawName = range.slice(0, separator).trim()
  const startsQuoted = rawName.startsWith("'")
  const endsQuoted = rawName.endsWith("'")
  if (startsQuoted !== endsQuoted) throw new Error('GOOGLE_SHEET_RANGE has an unmatched quote around the sheet name.')
  const sheetName = startsQuoted ? rawName.slice(1, -1).replace(/''/g, "'") : rawName
  const columns = range.slice(separator + 1).trim().match(/^([A-Z]+):([A-Z]+)$/i)
  if (!sheetName || !columns) throw new Error('GOOGLE_SHEET_RANGE must use a sheet name and full column range, such as Bookings!A:O.')

  const startColumn = columns[1].toUpperCase()
  const endColumn = columns[2].toUpperCase()
  const columnNumber = (column: string) => [...column].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0)
  if (columnNumber(endColumn) - columnNumber(startColumn) !== 14) {
    throw new Error('GOOGLE_SHEET_RANGE must span exactly 15 columns for the booking fields.')
  }
  return { sheetName, startColumn, endColumn }
}
