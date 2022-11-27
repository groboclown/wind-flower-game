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


function createAlternatingTokenSegment(
  size: BoardSize,
  startIndex: number
): (Tile | null)[] {
  const tokens = createEmptyTokenSegment(size)
  for (let i = 0; i < tokens.length; i++) {
    tokens[i] = {
      ...ALL_NON_EMPTY_TILES[(i + startIndex) % ALL_NON_EMPTY_TILES.length],
      height: (Math.random() * 5) | 0,
    }
  }
  return tokens
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
  rgb: [0.25, 0.25, 0.25],  // temporary
  height: 0,
  parameters: [],
}

const RED_TILE: Tile = {
  category: "red",
  rgb: [0.8, 0.2, 0.2],  // temporary
  height: 0,
  parameters: [],
}

const GREEN_TILE: Tile = {
  category: "green",
  rgb: [0.2, 0.8, 0.2],  // temporary
  height: 0,
  parameters: [],
}

const BLUE_TILE: Tile = {
  category: "blue",
  rgb: [0.2, 0.2, 0.8],  // temporary
  height: 0,
  parameters: [],
}

const YELLOW_TILE: Tile = {
  category: "yellow",
  rgb: [0.8, 0.8, 0.2],  // temporary
  height: 0,
  parameters: [],
}

const CYAN_TILE: Tile = {
  category: "cyan",
  rgb: [0.2, 0.8, 0.8],  // temporary
  height: 0,
  parameters: [],
}

const MAGENTA_TILE: Tile = {
  category: "magenta",
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
        let tileRow = row + odd
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
          tiles[tilePos + 1] = {
            category: token.category,
            rgb: [Math.max(0, token.rgb[0] * 0.8), Math.max(token.rgb[1] * 0.8), Math.max(0, token.rgb[2] * 0.8)],
            height: token.height,
            parameters: token.parameters,
          }
          tiles[tilePos + 2] = {
            category: token.category,
            rgb: [Math.max(0, token.rgb[0] * 0.6), Math.max(token.rgb[1] * 0.6), Math.max(0, token.rgb[2] * 0.6)],
            height: token.height,
            parameters: token.parameters,
          }
          tiles[tilePos + size.width + 0] = {
            category: token.category,
            rgb: [Math.min(1, token.rgb[0] * 1.2), Math.min(1, token.rgb[1] * 1.2), Math.min(1, token.rgb[2] * 1.2)],
            height: token.height,
            parameters: token.parameters,
          }
          tiles[tilePos + size.width + 1] = {
            category: token.category,
            rgb: [Math.min(1, token.rgb[0] * 1.3), Math.min(1, token.rgb[1] * 1.3), Math.min(1, token.rgb[2] + 1.3)],
            height: token.height,
            parameters: token.parameters,
          }
          tiles[tilePos + size.width + 2] = {
            category: token.category,
            rgb: [Math.min(1, token.rgb[0] * 1.4), Math.min(1, token.rgb[1] * 1.4), Math.min(1, token.rgb[2] * 1.4)],
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
