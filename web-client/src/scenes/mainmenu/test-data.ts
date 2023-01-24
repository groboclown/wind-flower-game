// Generate test game board data.
import {
  ServerParameters,
  GameLobbyCreated,
  GameParameters,
  SegmentTileCollection,
} from '../../server/structs'
import {
  AccountMananger,
  MockServer,
  AccountInfo,
  ServerError,
  MockServerSetup,
  createMockServerSetup,
} from '../../server/mock-server'
import { GAME_RUN_STATE__RUNNING } from '../../server/structs'
import { SegmentTile, NewAccount } from '../../server/structs'


// Must be a multiple of 3
export const MAX_RETURNED_WIDTH = 6 * 3
// Must be a multiple of 2
export const MAX_RETURNED_HEIGHT = 7 * 2


interface TestTile {
  category: string | null,
  height: number,
  variation: integer,
}


interface GameInfo {
  gameId: string
  protectedPassword: string | null
  unlisted: boolean
  createdAt: Date
  state: string
  lastTokenId: integer
  name: string
  minPlayers: integer
  maxPlayers: integer
  maxTurns: integer
  tileWidthMin: integer
  tileWidthMax: integer
  tileHeightMin: integer
  tileHeightMax: integer
}


export async function createMassDataMockServer(baseUrl: string): Promise<MockServerSetup> {
  return await createMockServerSetup(baseUrl, new TestMassDataMockServer())
}


class TestMassDataMockServer implements MockServer {
  private accountManager: AccountMananger | null
  private games: {[keys: string]: GameInfo}


  constructor() {
    this.accountManager = null
    this.games = {}
  }

  async setAccountManager(accountManager: AccountMananger): Promise<void> {
    this.accountManager = accountManager
  }

  async handleCreateAccount(): Promise<NewAccount> {
    if (this.accountManager === null) {
      throw new Error('not setup')
    }
    return await this.accountManager.createAccount()
  }

  async handleGetServerParameters(_requestor: AccountInfo): Promise<ServerParameters> {
    return {
      maximumTileWidth: MAX_RETURNED_WIDTH,
      maximumTileHeight: MAX_RETURNED_HEIGHT,
      maximumPlayerCount: 1,
    }
  }

  async handleStartGameLobby(
    _requestor: AccountInfo, name: string, maxPlayers: integer
  ): Promise<GameLobbyCreated> {
    const gameId = `game-${Object.keys(this.games).length}`
    this.games[gameId] = {
      gameId,
      name,
      createdAt: new Date(),
      protectedPassword: null,
      unlisted: false,
      state: GAME_RUN_STATE__RUNNING,  // should be lobby
      lastTokenId: 0,
      minPlayers: 1,
      maxPlayers,
      maxTurns: 100000,
      tileWidthMin: 3 * -1000,
      tileWidthMax: 3 * 1000,
      tileHeightMin: 2 * -1000,
      tileHeightMax: 2 * 1000,
    }
    return {
      gameId,
    }
  }

  async handleGetGameParameters(_requestor: AccountInfo, gameId: string): Promise<GameParameters> {
    const game = this.games[gameId]
    if (game === undefined) {
      throw new ServerError(404, 'NOT FOUND', `game "${gameId}" not visible or does not exist`)
    }
    return {
      gameName: game.name,
      protected: game.protectedPassword !== null,
      unlisted: game.unlisted,
      createdAt: game.createdAt,
      runState: game.state,
      minimumPlayerCount: game.minPlayers,
      maximumPlayerCount: game.maxPlayers,
      maximumTurnCount: game.maxTurns,
      parameters: [],
      currentPlayerTurn: 0,
      currentBoardColumnMin: game.tileWidthMin,
      currentBoardRowMin: game.tileHeightMin,
      currentBoardColumnMax: game.tileWidthMax,
      currentBoardRowMax: game.tileHeightMax,
      lastTurn: null,
      players: [],
    }
  }

  async handleLoadSegment(
    _requestor: AccountInfo,
    gameId: string,
    x: integer,
    y: integer,
    width: integer,
    height: integer,
  ): Promise<SegmentTileCollection> {
    const game = this.games[gameId]
    if (game === undefined) {
      throw new ServerError(404, 'NOT FOUND', `game "${gameId}" not visible or does not exist`)
    }

    const size: BoardSize = {
      width: Math.min(MAX_RETURNED_WIDTH, width as number),
      height: Math.min(MAX_RETURNED_HEIGHT, height as number),
    }

    const segments = hexTokensToSegment(
      size, x, y, game,
      createBorderedTokenSegment(size, x * y, 6),
    ).filter((v) => v.c !== null && v.c !== undefined)
    return {
      sizeX: size.width,
      sizeY: size.height,
      segments,
    }
  }
}


interface BoardSize {
  width: number
  height: number
}


export function createAlternatingTokenSegment(
  size: BoardSize,
  startIndex: number,
  heightType: integer,
): (TestTile | null)[] {
  const tokens = createNullTokenSegment(size)
  const tokenSize = getTokenBoardSize(size)
  for (let i = 0; i < tokens.length; i++) {
    tokens[i] = {
      ...ALL_NON_EMPTY_TILES[(i + startIndex) % ALL_NON_EMPTY_TILES.length],
      height: calculateHeight(i, tokenSize, heightType),
    }
  }
  return tokens
}


export function createAlternatingEmptyTokenSegment(
  size: BoardSize,
  startIndex: number,
  heightType: integer,
): (TestTile | null)[] {
  const tokens = createNullTokenSegment(size)
  const tokenSize = getTokenBoardSize(size)
  for (let i = 0; i < tokens.length; i++) {
    tokens[i] = {
      ...ALL_TILES[(i + startIndex) % ALL_TILES.length],
      height: calculateHeight(i, tokenSize, heightType),
    }
  }
  return tokens
}


export function createBorderedTokenSegment(
  size: BoardSize,
  _startIndex: number,
  heightType: integer,
): (TestTile | null)[] {
  const tokens = createNullTokenSegment(size)
  const tokenSize = getTokenBoardSize(size)
  let idx = 0
  for (let row = 0; row < tokenSize.height; row++) {
    for (let col = 0; col < tokenSize.width; col++) {
      const token = {
        ...RED_TILE,
        height: calculateHeight(idx, tokenSize, heightType),
      }
      tokens[idx] = token
      if (row <= 0) {
        if (col <= 0) {
          token.category = GREEN_TILE.category
        } else if (col >= tokenSize.width - 1) {
          token.category = BLUE_TILE.category
        }
      } else if (row >= tokenSize.height - 1) {
        if (col <= 0) {
          token.category = YELLOW_TILE.category
        } else if (col >= tokenSize.width - 1) {
          token.category = CYAN_TILE.category
        }
      } else {
        if (col <= 0) {
          token.category = MAGENTA_TILE.category
        } else if (col >= tokenSize.width - 1) {
          token.category = MOUNTAIN_TILE.category
        } else {
          token.category = WATER_TILE.category
        }
      }
      idx++
    }
  }
  for (let i = 0; i < tokens.length; i++) {
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
): (TestTile | null)[] {
  const tokenSize = getTokenBoardSize(size)
  const tokens = new Array<TestTile | null>(tokenSize.width * tokenSize.height)
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

export const EMPTY_TILE: TestTile = {
  category: null,
  variation: 0,
  height: -2,
}


const RED_TILE: TestTile = {
  category: 'red',
  variation: 0,
  height: 0,
}

const GREEN_TILE: TestTile = {
  category: 'green',
  variation: 0,
  height: 0,
}

const BLUE_TILE: TestTile = {
  category: 'blue',
  variation: 0,
  height: 0,
}

const YELLOW_TILE: TestTile = {
  category: 'yellow',
  variation: 0,
  height: 0,
}

const CYAN_TILE: TestTile = {
  category: 'cyan',
  variation: 0,
  height: 0,
}

const MAGENTA_TILE: TestTile = {
  category: 'magenta',
  variation: 0,
  height: 0,
}

const MOUNTAIN_TILE: TestTile = {
  category: 'mountain',
  variation: 0,
  height: 0,
}

const WATER_TILE: TestTile = {
  category: 'water',
  variation: 0,
  height: 0,
}

const DESERT_TILE: TestTile = {
  category: 'desert',
  variation: 0,
  height: 0,
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
  game: GameInfo,
  tokens: (TestTile | null)[],
): SegmentTile[] {

  // Note: this has a bug where the top row odd token columns
  //   are empty.  That's going to stay that way.

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
            const tokenId = game.lastTokenId++

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
