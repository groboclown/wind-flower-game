// Generate test game board data.
import {
	ClientTile,
} from '../../gameboard-state'
import { JsonLookup, JSONValueType } from '../../lib/typed-json'
import { RestApiConnection } from '../../server/api'
import { SegmentTile } from '../../server/structs'


// Must be a multiple of 3
export const MAX_RETURNED_WIDTH = 12
// Must be a multiple of 2
export const MAX_RETURNED_HEIGHT = 14


export class TestDataGeneratorApiConnection implements RestApiConnection {
  gameId: string
  lastTokenId: integer

  constructor(gameId: string) {
    this.gameId = gameId
    this.lastTokenId = 0
  }

  setServerPublicKey(_key: string): void {
    // ignore
  }

  // setAccountConnectionInformation set how the connection will mark the authorization information
  //   Either set based on cached client information or on create account requests.
  setAccountConnectionInformation(_accountId: string, _accountPrivateKey: string): void {
    // ignore
  }

  async getJson(path: string, parameters: JSONValueType): Promise<JsonLookup> {
    if (path === '/server/parameters') {
      return new JsonLookup({
        maximumTileWidth: MAX_RETURNED_WIDTH,
        maximumTileHeight: MAX_RETURNED_HEIGHT,
      })
    }
    if (path === `/game/${this.gameId}/segment`) {
      if (parameters !== null && typeof parameters === 'object' && ! Array.isArray(parameters)) {
        const x = parameters.x as number
        const y = parameters.y as number
        const size: BoardSize = {
          width: Math.min(MAX_RETURNED_WIDTH, parameters.width as number),
          height: Math.min(MAX_RETURNED_HEIGHT, parameters.height as number),
        }
        const retToken = [this.lastTokenId]

        const segments = hexTokensToSegment(
          size, x, y, retToken,
          createAlternatingEmptyTokenSegment(size, x * y, 6),
        )
        this.lastTokenId = retToken[0]
        return new JsonLookup({
          count: segments.length,
          segments: (segments as unknown) as JSONValueType[],
        })
      }
    }

    return new JsonLookup({
      error: {
        message: "Unknown path {path}",
        parameters: {
          path: path,
        }
      }
    })
  }

  async postJson(path: string, _parameters: JSONValueType): Promise<JsonLookup> {
    if (path === '/game') {
      return new JsonLookup({gameId: this.gameId})
    }

    return new JsonLookup({
      error: {
        message: "Unknown path {path}",
        parameters: {
          path: path,
        }
      }
    })
  }
}



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


export function createAlternatingTokenSegment(
  size: BoardSize,
  startIndex: number,
  heightType: integer,
): (ClientTile | null)[] {
  const tokens = createNullTokenSegment(size)
  const tokenSize = getTokenBoardSize(size)
  for (let i = 0; i < tokens.length; i++) {
    tokens[i] = {
      ...ALL_NON_EMPTY_TILES[(i + startIndex) % ALL_NON_EMPTY_TILES.length],
      height: calculateHeight(i, tokenSize, heightType),
      tokenId: (23 * size.width * size.height * startIndex) + i,
    }
  }
  return tokens
}


export function createAlternatingEmptyTokenSegment(
  size: BoardSize,
  startIndex: number,
  heightType: integer,
): (ClientTile | null)[] {
  const tokens = createNullTokenSegment(size)
  const tokenSize = getTokenBoardSize(size)
  for (let i = 0; i < tokens.length; i++) {
    tokens[i] = {
      ...ALL_TILES[(i + startIndex) % ALL_TILES.length],
      height: calculateHeight(i, tokenSize, heightType),
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


function getTokenBoardSize(
  size: BoardSize,
): BoardSize {
  const tokenWidth = (size.width / 3) | 0
  const tokenHeight = (size.height / 2) | 0
  if (
      size.width % 3 !== 0
      || size.height % 2 !== 0
  ) {
    throw new Error(`bad setup; token array must be ${tokenWidth} x ${tokenHeight}, requested ${size.width} x ${size.height}`)
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
  tokenIdCounter: integer[],
  tokens: (ClientTile | null)[],
): SegmentTile[] {
  const tokenSize = getTokenBoardSize(size)
  const tokenWidth = tokenSize.width
  const tokenHeight = tokenSize.height
  if (tokenWidth *tokenHeight !== tokens.length) {
    throw new Error(`bad setup; token array must be ${tokenWidth} x ${tokenHeight}`)
  }
  const tiles: SegmentTile[] = []

  // Only generate tiles whose tokens aren't empty.
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
          const category = token.category
          if (category !== null) {
            // Eventually, have real parameters.
            const tokenId = tokenIdCounter[0]++

            tiles.push({
              c: category,
              h: token.height,
              x: col + x,
              y: row + y + odd,
              t: tokenId,
              p: [],
            })
            tiles.push({
              c: category,
              h: token.height,
              x: col + x + 1,
              y: row + y + odd,
              t: tokenId,
              p: [],
            })
            tiles.push({
              c: category,
              h: token.height,
              x: col + x + 2,
              y: row + y + odd,
              t: tokenId,
              p: [],
            })
            tiles.push({
              c: category,
              h: token.height,
              x: col + x,
              y: row + y + 1 + odd,
              t: tokenId,
              p: [],
            })
            tiles.push({
              c: category,
              h: token.height,
              x: col + x + 1,
              y: row + y + 1 + odd,
              t: tokenId,
              p: [],
            })
            tiles.push({
              c: category,
              h: token.height,
              x: col + x + 2,
              y: row + y + 1 + odd,
              t: tokenId,
              p: [],
            })
          }
        }
      }
      col += 3
    }
    row += 2
  }
  return tiles
}
