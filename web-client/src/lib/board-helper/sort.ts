// Utilities for sorting the game board
import { GameBoardSegment } from '../../store/state/board'


// sortGameBoardSegments sort the segments by row / column.
//    Access by segments[rowIndex][columnIndex]
export function sortGameBoardSegments(
  segments: {[keys: string]: GameBoardSegment},
): GameBoardSegment[][] {
  const sorted: GameBoardSegment[][] = []

  // First, sort by row.  Put them on rows.
  const byRow = groupSegmentsBy(Object.values(segments), (s) => s.position.y)

  // Then sort each column
  sortNumericKeys(byRow).forEach((columnKey) => {
    const currentRow: GameBoardSegment[] = []
    sorted.push(currentRow)

    const byColumn = groupSegmentsBy(byRow[columnKey], (s) => s.position.x)
    sortNumericKeys(byColumn).forEach((rowKey) => {
      // And for idential x,y coordinates, add them to the list.
      byColumn[rowKey].forEach((s) => currentRow.push(s))
    })
  })
  return sorted
}


function groupSegmentsBy(
  segments: GameBoardSegment[],
  getValue: (g: GameBoardSegment) => number,
): {[key: string]: GameBoardSegment[]} {
  const groups: {[key: string]: GameBoardSegment[]} = {}
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


function sortNumericKeys(grouping: {[key: string]: GameBoardSegment[]}): string[] {
  const keyFloat: {[key: string]: number} = {}
  const keys: string[] = Object.keys(grouping)
  keys.sort((a, b) => keyFloat[a] - keyFloat[b])
  return keys
}
