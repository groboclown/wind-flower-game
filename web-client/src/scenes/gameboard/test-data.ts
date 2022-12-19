// Generate test game board data.
import {
	ClientTile,
	ClientGameBoardSegment,
} from '../../gameboard-state'


interface BoardSize {
  width: number
  height: number
}

/*
export function createBoardRect(
  segments: ClientGameBoardSegment[],
  segmentSize: BoardSize,
): BoardRect {
  let minX = 1000000000
  let maxX = -1000000000
  let minY = 1000000000
  let maxY = -1000000000

  for (let i = 0; i < segments.length; i++) {
    const segMinX = segments[i].x
    const segMinY = segments[i].y
    const segMaxX = segMinX + segmentSize.width
    const segMaxY = segMinY + segmentSize.height
    minX = Math.min(segMinX, minX)
    maxX = Math.max(segMaxX, maxX)
    minY = Math.min(segMinY, minY)
    maxY = Math.min(segMaxY, maxY)
  }
  return { minX, minY, maxX, maxY }
}
*/


export function createBlankBoard(
  size: BoardSize,
): {[keys: string]: ClientGameBoardSegment} {
  return createGameBoard(
    size,
    [
      createEmptyTokenSegment(size, 0),
      createEmptyTokenSegment(size, 1),
      createEmptyTokenSegment(size, 2),

      createEmptyTokenSegment(size, 3),
      createEmptyTokenSegment(size, 4),
      createEmptyTokenSegment(size, 5),

      createEmptyTokenSegment(size, 6),
      createEmptyTokenSegment(size, 7),
      createEmptyTokenSegment(size, 8),
    ]
  )
}


export function createAlternatingBoard(
  size: BoardSize,
): {[keys: string]: ClientGameBoardSegment} {
  return createGameBoard(
    size,
    [
      createAlternatingEmptyTokenSegment(size, 0),
      createAlternatingEmptyTokenSegment(size, 1),
      createAlternatingEmptyTokenSegment(size, 2),

      createAlternatingTokenSegment(size, 3),
      createAlternatingEmptyTokenSegment(size, 4),
      createAlternatingTokenSegment(size, 5),

      createAlternatingEmptyTokenSegment(size, 6),
      createAlternatingEmptyTokenSegment(size, 7),
      createAlternatingEmptyTokenSegment(size, 8),
    ],
  )
}


export function createAlternatingTokenSegment(
  size: BoardSize,
  startIndex: number
): (ClientTile | null)[] {
  const tokens = createNullTokenSegment(size)
  const tokenSize = getTokenBoardSize(size)
  for (let i = 0; i < tokens.length; i++) {
    tokens[i] = {
      ...ALL_NON_EMPTY_TILES[(i + startIndex) % ALL_NON_EMPTY_TILES.length],
      height: calculateHeight(i, tokenSize, 6),
      tokenId: (23 * size.width * size.height * startIndex) + i,
    }
  }
  return tokens
}


export function createAlternatingEmptyTokenSegment(
  size: BoardSize,
  startIndex: number
): (ClientTile | null)[] {
  const tokens = createNullTokenSegment(size)
  const tokenSize = getTokenBoardSize(size)
  for (let i = 0; i < tokens.length; i++) {
    tokens[i] = {
      ...ALL_TILES[(i + startIndex) % ALL_TILES.length],
      height: calculateHeight(i, tokenSize, 6),
      tokenId: (23 * size.width * size.height * startIndex) + i,
    }
  }
  return tokens
}


export function createEmptyTokenSegment(
  size: BoardSize,
  startIndex: number
): (ClientTile | null)[] {
  const tokens = createNullTokenSegment(size)
  const tokenSize = getTokenBoardSize(size)
  for (let i = 0; i < tokens.length; i++) {
    tokens[i] = {
      ...ALL_TILES[(i + startIndex) % ALL_TILES.length],
      height: calculateHeight(i, tokenSize, 6),
      tokenId: (23 * size.width * size.height * startIndex) + i,
    }
  }
  return tokens
}


function calculateHeight(tokenIndex: number, tokenBoardSize: BoardSize, heightType: number): number {
  const row = (tokenIndex / tokenBoardSize.width) | 0
  const column = tokenIndex % tokenBoardSize.width
  switch (heightType) {
      case 1:
        // Everything but empty tiles the same height
        return 1

      case 2:
        // Random integer heights
        return (Math.random() * 6) | 0

      case 3:
        // Wavy heights
        return (Math.sin(tokenIndex / 10) * 4) + 5

      case 4:
        // Alternating heights
        return (((tokenIndex % tokenBoardSize.height) % 2) * 5) + 1

      case 5:
        // Increasing heights along the diagonal
        return tokenIndex / 5

      // wave rings
      case 6:
        return Math.sin(Math.sqrt(
          (((tokenBoardSize.height / 2) - row) * ((tokenBoardSize.height / 2) - row)
          + ((tokenBoardSize.width / 2) - column) * ((tokenBoardSize.width / 2) - column))) * 2) * 4

      case 7:
        // == row
        return row

      case 8:
        // == column
        return column

      // Everything the same height, even empty tiles
      case 0:
      default:
        return 0

  }
}


function createNullTokenSegment(
  size: BoardSize,
): (ClientTile | null)[] {
  const tokenSize = getTokenBoardSize(size)
  const tokens = new Array<ClientTile | null>(tokenSize.width * tokenSize.height)
  return tokens
}


// createGameBoard create a 3x3 game board, with a collection of 3x3 token grid.
function createGameBoard(
  size: BoardSize,
  tokens: (ClientTile | null)[][],
): {[keys: string]: ClientGameBoardSegment} {
  if (tokens.length !== 9) {
    throw new Error(`Expected 9 token groups, found ${tokens.length}`)
  }
  return asMappedSegments([
    hexTokensToSegment(size, -(size.width * 1.5) | 0, -(size.height * 1.5) | 0, tokens[0]),
    hexTokensToSegment(size, -(size.width * 0.5) | 0, -(size.height * 1.5) | 0, tokens[1]),
    hexTokensToSegment(size,  (size.width * 0.5) | 0, -(size.height * 1.5) | 0, tokens[2]),

    hexTokensToSegment(size, -(size.width * 1.5) | 0, -(size.height * 0.5) | 0, tokens[3]),
    hexTokensToSegment(size, -(size.width * 1.5) | 0, -(size.height * 0.5) | 0, tokens[4]),
    hexTokensToSegment(size, -(size.width * 1.5) | 0, -(size.height * 0.5) | 0, tokens[5]),

    hexTokensToSegment(size, -(size.width * 1.5) | 0,  (size.height * 0.5) | 0, tokens[6]),
    hexTokensToSegment(size, -(size.width * 0.5) | 0,  (size.height * 0.5) | 0, tokens[7]),
    hexTokensToSegment(size,  (size.width * 0.5) | 0,  (size.height * 0.5) | 0, tokens[8]),
  ])
}


function asMappedSegments(segments: ClientGameBoardSegment[]) {
  const ret: {[keys: string]: ClientGameBoardSegment} = {}
  segments.forEach((seg) => {
    ret[seg.segmentId] = seg
  })
  return ret
}


function getTokenBoardSize(
  size: BoardSize,
): BoardSize {
  const tokenWidth = (size.width / 3) | 0
  const tokenHeight = (size.height / 2) | 0
  if (
      size.width % 3 !== 0
      || size.height % 2 !== 0
  ) {
    throw new Error(`bad setup; token array must be ${tokenWidth} x ${tokenHeight}`)
  }
  return { width: tokenWidth, height: tokenHeight | 0 }
}

export const EMPTY_TILE: ClientTile = {
  tokenId: null,
  category: null,
  variation: 0,
  height: -2,
  parameters: {},

  hasAdjacentPlacedTile: false,
  isPlayerPlaceableToken: false,
}


const RED_TILE: ClientTile = {
  category: 'red',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
  hasAdjacentPlacedTile: false,
  isPlayerPlaceableToken: false,
}

const GREEN_TILE: ClientTile = {
  category: 'green',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
  hasAdjacentPlacedTile: false,
  isPlayerPlaceableToken: false,
}

const BLUE_TILE: ClientTile = {
  category: 'blue',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
  hasAdjacentPlacedTile: false,
  isPlayerPlaceableToken: false,
}

const YELLOW_TILE: ClientTile = {
  category: 'yellow',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
  hasAdjacentPlacedTile: false,
  isPlayerPlaceableToken: false,
}

const CYAN_TILE: ClientTile = {
  category: 'cyan',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
  hasAdjacentPlacedTile: false,
  isPlayerPlaceableToken: false,
}

const MAGENTA_TILE: ClientTile = {
  category: 'magenta',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
  hasAdjacentPlacedTile: false,
  isPlayerPlaceableToken: false,
}

const MOUNTAIN_TILE: ClientTile = {
  category: 'mountain',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
  hasAdjacentPlacedTile: false,
  isPlayerPlaceableToken: false,
}

const WATER_TILE: ClientTile = {
  category: 'water',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
  hasAdjacentPlacedTile: false,
  isPlayerPlaceableToken: false,
}

const DESERT_TILE: ClientTile = {
  category: 'desert',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
  hasAdjacentPlacedTile: false,
  isPlayerPlaceableToken: false,
}

const ALL_TILES = [EMPTY_TILE, RED_TILE, GREEN_TILE, BLUE_TILE, YELLOW_TILE, CYAN_TILE, MAGENTA_TILE, MOUNTAIN_TILE, WATER_TILE, DESERT_TILE]
const ALL_NON_EMPTY_TILES = [RED_TILE, GREEN_TILE, BLUE_TILE, YELLOW_TILE, CYAN_TILE, MAGENTA_TILE, MOUNTAIN_TILE, WATER_TILE, DESERT_TILE]


// hexTokensToSegment Turns a NxM grid of hex tokens (column major) into a segment.
//   Each hex token is the equivalent to a 3x2 tile set in the game board segment.
//   They will be arranged like:
//     A A A - - - C C C
//     A A A B B B C C C
//     - - - B B B - - -
//   per row.
//   A null token will be turned into an empty tile.
function hexTokensToSegment(
  size: BoardSize,
  x: number, y: number,
  tokens: (ClientTile | null)[],
): ClientGameBoardSegment {
  const tokenSize = getTokenBoardSize(size)
  const tokenWidth = tokenSize.width
  const tokenHeight = tokenSize.height
  if (tokenWidth *tokenHeight !== tokens.length) {
    throw new Error(`bad setup; token array must be ${tokenWidth} x ${tokenHeight}`)
  }
  const tiles = Array<ClientTile>(size.width * size.height)

  // First, fill the out tiles with empty tiles.
  for (let i = 0; i < tiles.length; i++) {
    tiles[i] = EMPTY_TILE
  }
  // console.log(`Creating segments at (${position.x}, ${position.y}) sized (${size.width}, ${size.height}) / ${tiles.length}`)

  // Then, fill in the spots with the source tokens.
  let row = 0
  let hexPos = 0
  for (let hexY = 0; hexY < tokenHeight; hexY++) {
    let col = 0
    for (let hexX = 0; hexX < tokenWidth; hexX++) {
      const token = tokens[hexPos++]
      if (token !== null && col + 2 < size.width) {
        const odd = hexX & 0x1
        const tileRow = row + odd
        if (tileRow + 1 < size.height) {
          // Should be an exact copy of each tile,
          //   but we'll add some color variance to be able to determine
          //   which tile piece it is for each token.

          const tilePos = (tileRow * size.width) + col

          tiles[tilePos + 0] = {
            category: token.category,
            variation: (Math.random() * 4) | 0,
            height: token.height,
            tokenId: token.tokenId,
            parameters: token.parameters,
            hasAdjacentPlacedTile: false,
            isPlayerPlaceableToken: false,
          }
          // For debugging, the colors can change per triangle to
          //   ensure that they are positioned correctly on the screen.
          tiles[tilePos + 1] = {
            category: token.category,
            variation: (Math.random() * 4) | 0,
            height: token.height,
            tokenId: token.tokenId,
            parameters: token.parameters,
            hasAdjacentPlacedTile: false,
            isPlayerPlaceableToken: false,
          }
          tiles[tilePos + 2] = {
            category: token.category,
            variation: (Math.random() * 4) | 0,
            height: token.height,
            tokenId: token.tokenId,
            parameters: token.parameters,
            hasAdjacentPlacedTile: false,
            isPlayerPlaceableToken: false,
          }
          tiles[tilePos + size.width + 0] = {
            category: token.category,
            variation: (Math.random() * 4) | 0,
            height: token.height,
            tokenId: token.tokenId,
            parameters: token.parameters,
            hasAdjacentPlacedTile: false,
            isPlayerPlaceableToken: false,
          }
          tiles[tilePos + size.width + 1] = {
            category: token.category,
            variation: (Math.random() * 4) | 0,
            height: token.height,
            tokenId: token.tokenId,
            parameters: token.parameters,
            hasAdjacentPlacedTile: false,
            isPlayerPlaceableToken: false,
          }
          tiles[tilePos + size.width + 2] = {
            category: token.category,
            variation: (Math.random() * 4) | 0,
            height: token.height,
            tokenId: token.tokenId,
            parameters: token.parameters,
            hasAdjacentPlacedTile: false,
            isPlayerPlaceableToken: false,
          }
        }
      }
      col += 3
    }
    row += 2
  }

  // console.log(`Final segment length: ${tiles.length}`)
  return {
    x, y,
    tiles,
    segmentId: `${x},${y}`,
  }
}
