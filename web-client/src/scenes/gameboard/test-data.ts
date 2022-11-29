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
      createAlternatingTokenSegment(size, 0),
      createAlternatingTokenSegment(size, 1),
      createAlternatingTokenSegment(size, 2),

      createAlternatingTokenSegment(size, 3),
      createAlternatingTokenSegment(size, 4),
      createAlternatingTokenSegment(size, 5),

      createAlternatingTokenSegment(size, 6),
      createAlternatingTokenSegment(size, 7),
      createAlternatingTokenSegment(size, 8),
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
  rgb: [0.0, 0.0, 0.0],  // temporary
  height: -10,
  parameters: [],
}

const RED_TILE: Tile = {
  category: 'red',
  rgb: [0.8, 0.2, 0.2],  // temporary
  height: 0,
  parameters: [],
}

const GREEN_TILE: Tile = {
  category: 'green',
  rgb: [0.2, 0.8, 0.2],  // temporary
  height: 0,
  parameters: [],
}

const BLUE_TILE: Tile = {
  category: 'blue',
  rgb: [0.2, 0.2, 0.8],  // temporary
  height: 0,
  parameters: [],
}

const YELLOW_TILE: Tile = {
  category: 'yellow',
  rgb: [0.8, 0.8, 0.2],  // temporary
  height: 0,
  parameters: [],
}

const CYAN_TILE: Tile = {
  category: 'cyan',
  rgb: [0.2, 0.8, 0.8],  // temporary
  height: 0,
  parameters: [],
}

const MAGENTA_TILE: Tile = {
  category: 'magenta',
  rgb: [0.8, 0.2, 0.8],  // temporary
  height: 0,
  parameters: [],
}

const ALL_TILES = [EMPTY_TILE, RED_TILE, GREEN_TILE, BLUE_TILE, YELLOW_TILE, CYAN_TILE, MAGENTA_TILE]
const ALL_NON_EMPTY_TILES = [RED_TILE, GREEN_TILE, BLUE_TILE, YELLOW_TILE, CYAN_TILE, MAGENTA_TILE]


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
            rgb: [token.rgb[0], token.rgb[1], token.rgb[2]],
            height: token.height,
            parameters: token.parameters,
          }
          // For debugging, the colors can change per triangle to
          //   ensure that they are positioned correctly on the screen.
          tiles[tilePos + 1] = {
            category: token.category,
            // rgb: [Math.max(0, token.rgb[0] * 0.8), Math.max(token.rgb[1] * 0.8), Math.max(0, token.rgb[2] * 0.8)],
            rgb: [token.rgb[0], token.rgb[1], token.rgb[2]],
            height: token.height,
            parameters: token.parameters,
          }
          tiles[tilePos + 2] = {
            category: token.category,
            // rgb: [Math.max(0, token.rgb[0] * 0.6), Math.max(token.rgb[1] * 0.6), Math.max(0, token.rgb[2] * 0.6)],
            rgb: [token.rgb[0], token.rgb[1], token.rgb[2]],
            height: token.height,
            parameters: token.parameters,
          }
          tiles[tilePos + size.width + 0] = {
            category: token.category,
            // rgb: [Math.min(1, token.rgb[0] * 1.2), Math.min(1, token.rgb[1] * 1.2), Math.min(1, token.rgb[2] * 1.2)],
            rgb: [token.rgb[0], token.rgb[1], token.rgb[2]],
            height: token.height,
            parameters: token.parameters,
          }
          tiles[tilePos + size.width + 1] = {
            category: token.category,
            // rgb: [Math.min(1, token.rgb[0] * 1.3), Math.min(1, token.rgb[1] * 1.3), Math.min(1, token.rgb[2] + 1.3)],
            rgb: [token.rgb[0], token.rgb[1], token.rgb[2]],
            height: token.height,
            parameters: token.parameters,
          }
          tiles[tilePos + size.width + 2] = {
            category: token.category,
            // rgb: [Math.min(1, token.rgb[0] * 1.4), Math.min(1, token.rgb[1] * 1.4), Math.min(1, token.rgb[2] * 1.4)],
            rgb: [token.rgb[0], token.rgb[1], token.rgb[2]],
            height: token.height,
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
