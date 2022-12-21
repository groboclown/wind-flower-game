// Utilities for sorting the game board
import { ClientGameBoardSegment } from '.'


// sortGameBoardSegments sort the segments by row / column.
//    Access by segments[rowIndex][columnIndex]
export function sortGameBoardSegmentMap(
  segments: {[keys: string]: ClientGameBoardSegment},
): ClientGameBoardSegment[][] {
  return sortGameBoardSegmentList(Object.values(segments))
}


// sortGameBoardSegments sort the segments by row / column.
//    Access by segments[rowIndex][columnIndex]
export function sortGameBoardSegmentList(
  segments: ClientGameBoardSegment[],
): ClientGameBoardSegment[][] {
  const sorted: ClientGameBoardSegment[][] = []

  // First, sort by row.  Put them on rows.
  const byRow = groupSegmentsBy(segments, (s) => s.y)

  // Then sort each column
  sortNumericKeys(byRow).forEach((columnKey) => {
    const currentRow: ClientGameBoardSegment[] = []
    sorted.push(currentRow)

    const byColumn = groupSegmentsBy(byRow[columnKey], (s) => s.x)
    sortNumericKeys(byColumn).forEach((rowKey) => {
      // And for idential x,y coordinates, add them to the list.
      byColumn[rowKey].forEach((s) => currentRow.push(s))
    })
  })
  return sorted
}


function groupSegmentsBy(
  segments: ClientGameBoardSegment[],
  getValue: (g: ClientGameBoardSegment) => number,
): {[key: string]: ClientGameBoardSegment[]} {
  const groups: {[key: string]: ClientGameBoardSegment[]} = {}
  segments.forEach((seg) => {
    const key = String(getValue(seg))
    let items = groups[key]
    if (items === undefined) {
      items = []
      groups[key] = items
    }
    items.push(seg)
  })
  return groups
}


function sortNumericKeys(grouping: {[key: string]: ClientGameBoardSegment[]}): string[] {
  const keyFloat: {[key: string]: number} = {}
  const keys: string[] = Object.keys(grouping)
  keys.sort((a, b) => keyFloat[a] - keyFloat[b])
  return keys
}
