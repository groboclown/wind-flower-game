// Generate test game board data.
import {
	Tile,
	BoardSize,
  BoardPosition,
	BoardRect,
	GameBoardSegment,
} from '../../store'


export function createBoardRect(
  size: BoardSize,
): BoardRect {
  return {
    minX: -(size.width * 1.5) | 0,
    maxX:  (size.width * 1.5) | 0,
    minY: -(size.height * 1.5) | 0,
    maxY:  (size.height * 1.5) | 0,
  }
}


export function createAlternatingBoard(
  size: BoardSize,
): GameBoardSegment[] {
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
): (Tile | null)[] {
  const tokens = createEmptyTokenSegment(size)
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
): (Tile | null)[] {
  const tokens = createEmptyTokenSegment(size)
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



function createEmptyTokenSegment(
  size: BoardSize,
): (Tile | null)[] {
  const tokenSize = getTokenBoardSize(size)
  const tokens = new Array<Tile | null>(tokenSize.width * tokenSize.height)
  return tokens
}


// createGameBoard create a 3x3 game board, with a collection of 3x3 token grid.
function createGameBoard(
  size: BoardSize,
  tokens: (Tile | null)[][],
): GameBoardSegment[] {
  if (tokens.length !== 9) {
    throw new Error(`Expected 9 token groups, found ${tokens.length}`)
  }
  return [
    hexTokensToSegment(size, {x: -(size.width * 1.5) | 0, y: -(size.height * 1.5) | 0}, tokens[0]),
    hexTokensToSegment(size, {x: -(size.width * 0.5) | 0, y: -(size.height * 1.5) | 0}, tokens[1]),
    hexTokensToSegment(size, {x:  (size.width * 0.5) | 0, y: -(size.height * 1.5) | 0}, tokens[2]),

    hexTokensToSegment(size, {x: -(size.width * 1.5) | 0, y: -(size.height * 0.5) | 0}, tokens[3]),
    hexTokensToSegment(size, {x: -(size.width * 1.5) | 0, y: -(size.height * 0.5) | 0}, tokens[4]),
    hexTokensToSegment(size, {x: -(size.width * 1.5) | 0, y: -(size.height * 0.5) | 0}, tokens[5]),

    hexTokensToSegment(size, {x: -(size.width * 1.5) | 0, y:  (size.height * 0.5) | 0}, tokens[6]),
    hexTokensToSegment(size, {x: -(size.width * 0.5) | 0, y:  (size.height * 0.5) | 0}, tokens[7]),
    hexTokensToSegment(size, {x:  (size.width * 0.5) | 0, y:  (size.height * 0.5) | 0}, tokens[8]),
  ]
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


const EMPTY_TILE: Tile = {
  category: null,
  variation: 0,
  height: -10,
  tokenId: null,
  parameters: [],
}

const RED_TILE: Tile = {
  category: 'red',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
}

const GREEN_TILE: Tile = {
  category: 'green',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
}

const BLUE_TILE: Tile = {
  category: 'blue',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
}

const YELLOW_TILE: Tile = {
  category: 'yellow',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
}

const CYAN_TILE: Tile = {
  category: 'cyan',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
}

const MAGENTA_TILE: Tile = {
  category: 'magenta',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
}

const MOUNTAIN_TILE: Tile = {
  category: 'mountain',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
}

const WATER_TILE: Tile = {
  category: 'water',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
}

const DESERT_TILE: Tile = {
  category: 'desert',
  variation: 0,
  height: 0,
  tokenId: null,
  parameters: [],
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
  position: BoardPosition,
  tokens: (Tile | null)[],
): GameBoardSegment {
  const tokenSize = getTokenBoardSize(size)
  const tokenWidth = tokenSize.width
  const tokenHeight = tokenSize.height
  if (tokenWidth *tokenHeight !== tokens.length) {
    throw new Error(`bad setup; token array must be ${tokenWidth} x ${tokenHeight}`)
  }
  const tiles = Array<Tile>(size.width * size.height)

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
          }
          // For debugging, the colors can change per triangle to
          //   ensure that they are positioned correctly on the screen.
          tiles[tilePos + 1] = {
            category: token.category,
            variation: (Math.random() * 4) | 0,
            height: token.height,
            tokenId: token.tokenId,
            parameters: token.parameters,
          }
          tiles[tilePos + 2] = {
            category: token.category,
            variation: (Math.random() * 4) | 0,
            height: token.height,
            tokenId: token.tokenId,
            parameters: token.parameters,
          }
          tiles[tilePos + size.width + 0] = {
            category: token.category,
            variation: (Math.random() * 4) | 0,
            height: token.height,
            tokenId: token.tokenId,
            parameters: token.parameters,
          }
          tiles[tilePos + size.width + 1] = {
            category: token.category,
            variation: (Math.random() * 4) | 0,
            height: token.height,
            tokenId: token.tokenId,
            parameters: token.parameters,
          }
          tiles[tilePos + size.width + 2] = {
            category: token.category,
            variation: (Math.random() * 4) | 0,
            height: token.height,
            tokenId: token.tokenId,
            parameters: token.parameters,
          }
        }
      }
      col += 3
    }
    row += 2
  }

  // console.log(`Final segment length: ${tiles.length}`)
  return {
    position,
    tiles,
  }
}
