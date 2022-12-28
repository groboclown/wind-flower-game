// Manages the game board state

import { ClientGameBoard, TileParameterType, ClientTile, ClientGameBoardSegment } from './state'
import { GameBoardRequests, GameBoardStatusHandler } from './events'
import { HostApi } from '../server/api'
import { GameBoardManager } from './manager'
import { CATEGORY_UNSET, CATEGORY_LOADING, CATEGORY_EMPTY } from './asset-names'


const EMPTY_TILE: ClientTile = {
  tokenId: null,
  category: CATEGORY_UNSET,
  variation: 0,
  height: -2,
  parameters: {},

  hasAdjacentPlacedTile: false,
  isPlayerPlaceableToken: false,
}

const LOADING_TILE: ClientTile = {
  tokenId: null,
  category: CATEGORY_LOADING,
  variation: 0,
  height: -2,
  parameters: {},

  hasAdjacentPlacedTile: false,
  isPlayerPlaceableToken: false,
}


function getAbsSegmentId(x: integer, y: integer): string {
  return `${x},${y}`
}



export class GameBoardManagerImpl implements GameBoardManager {
  private gameId: string
  board: ClientGameBoard
  private server: HostApi
  private callbacks: {handler: GameBoardStatusHandler, req: CallbackRequest}[]
  private loadingSegments: {[key: string]: boolean}


  constructor(
    hostApi: HostApi,
    gameId: string,
    segmentWidth: integer,
    segmentHeight: integer,
    parameterTypes: TileParameterType[],
  ) {
    const paramMap: {[keys: integer]: TileParameterType} = {}
    parameterTypes.forEach((pt) => {
      paramMap[pt.key] = pt
    })

    this.server = hostApi
    this.gameId = gameId
    this.callbacks = []
    this.loadingSegments = {}
    this.board = {
      boardWidth: 0,
      boardHeight: 0,
      boardMinX: 0,
      boardMaxX: 0,
      boardMinY: 0,
      boardMaxY: 0,

      segmentWidth,
      segmentHeight,
      parameterTypes: parameterTypes,
      segments: {},

      loadId: 0,

      clientPlacedTile0: {...EMPTY_TILE},
      clientPlacedTile1: {...EMPTY_TILE},
      clientPlacedTile2: {...EMPTY_TILE},
      clientPlacedTile3: {...EMPTY_TILE},
      clientPlacedTile4: {...EMPTY_TILE},
      clientPlacedTile5: {...EMPTY_TILE},
      clientPlacedTokenX: 0,
      clientPlacedTokenY: 0,
      clientPlacedSegmentId: "",
    }
  }

  registerHandler(handler: GameBoardStatusHandler): GameBoardRequests {
    const req = new CallbackRequest(this)
    this.callbacks.push({handler, req})
    return req
  }

  removeHandler(handler: GameBoardStatusHandler): void {
    const newCallbacks: {handler: GameBoardStatusHandler, req: CallbackRequest}[] = []
    this.callbacks.forEach((cb) => {
      if (cb.handler === handler) {
        cb.req.dispose()
      } else {
        newCallbacks.push(cb)
      }
    })
    this.callbacks = newCallbacks
  }

  // -----------------------------------------------------------
  // Internal stuff.

  // loadSegment Load the segment from the server into the board.
  // The x/y must be normalized to the segment origin.
  async loadSegment(segmentId: string, x: integer, y: integer): Promise<void> {
    if (this.board.segments[segmentId] !== undefined || this.loadingSegments[segmentId] === true) {
      // already loaded, or being loaded
      return
    }
    // Mark that the loading is starting, so we don't have multiple of these in-flight.
    this.loadingSegments[segmentId] = true

    // Because this is now loading, we must mark the tiles as loading before
    // the async stuff starts.  That means this call allocates memory before the
    // promise returns.

    // This also needs to keep track of tiles that are empty, and make
    // sure after a server load, that those tiles are replaced with empty tokens.

    const width = this.board.segmentWidth
    const height = this.board.segmentHeight
    const count = width * height
    const tiles: ClientTile[] = new Array<ClientTile>()
    const emptyServerTiles: {[keys: integer]: integer} = {}
    for (let i = 0; i < count; i++) {
      tiles[i] = {
        ...LOADING_TILE,
        // The parameters need to be a new object, not a pointer to the same object.
        parameters: {},
      }
      emptyServerTiles[i] = i
    }
    const segment: ClientGameBoardSegment = {
      segmentId,
      x,
      y,
      tiles,
    }
    this.board.segments[segmentId] = segment

    // Because the board state changed, the board load ID must change.
    this.board.loadId++

    // However, the load hasn't happened, so the report loading isn't called yet.

    // Start the asynchronous, waiting code.
    const serverTiles = await this.server.loadSegment(
      this.gameId,
      x,
      y,
      width,
      height,
    )

    // The server returns the tiles with data in them.
    // This model stores a segment fully populated to make
    // index work quickly.  That means the tiles must be
    // created empty, and filled in based on the server response.

    serverTiles.forEach((serverTile) => {
      const tileIndex = (serverTile.x - x) + ((serverTile.y - y) * width)
      delete emptyServerTiles[tileIndex]
      const tile = tiles[tileIndex]
      tile.category = serverTile.c
      tile.height = serverTile.h
      tile.tokenId = serverTile.t
      serverTile.p.forEach((param) => {
        tile.parameters[param.i] = param.q
      })
    })
    Object.values(emptyServerTiles).forEach((tileIndex) => {
      const tile = tiles[tileIndex]
      // TODO detect if it's placeable.
      tile.category = CATEGORY_EMPTY
    })

    // The board state just changed again, so update the load id.
    this.board.loadId++
    // And mark the segment as no longer loading
    delete this.loadingSegments[segmentId]

    // Now we can report the segment as loaded.
    this.callbacks.forEach((cb) => {
      cb.handler.onSegmentLoaded(segment.x, segment.y, segment.segmentId)
    })
  }
}



class CallbackRequest implements GameBoardRequests {
  private parent: GameBoardManagerImpl | null

  constructor(parent: GameBoardManagerImpl) {
    this.parent = parent
  }

  dispose() {
    this.parent = null
  }

  populateNormalizedSegmentPosition(x: integer, y: integer, normalized: integer[]): void {
    if (this.parent === null) {
      throw new Error('Handler deactivated')
    }
    // get an absolute position of the coordinate, so that it's a whole
    // board segment number.  By modulating the segment size, it makes
    // the value the remainder, so subtracting that means we're left with
    // a whole board position.  e.g. board size of 10, value 22: 22 % 10 = 2,
    // 22 - 2 = 20, which is a whole board size.
    // Modulo with negative numbers, though is different.  If width is 10, and
    // the first segment is at 0, then we should have segments at -10, 0, and 10.
    // For x == 8, 8 % 10 = 8 which means the segment x is 0 (8 - (8 % 10)).
    // However, for -8, it should be at -10, however -8 - (-8 % 10) is also 0.
    // Instead, we need to perform the right modulo calculation.

    const w = this.parent.board.segmentWidth
    const h = this.parent.board.segmentHeight

    let deltaX = x % w
    let deltaY = y % h
    if (deltaX < 0) {
      // For the example above, for w == 10, -8 % 10 == -8, but
      // we need to have it be 2, so that the x == -8 goes down
      // to the -10, the segment it belongs to.
      deltaX += w
    }
    if (deltaY < 0) {
      deltaY += h
    }

    normalized[0] = x - deltaX
    normalized[1] = y - deltaY
  }

  getSegmentId(x: integer, y: integer): string {
    if (this.parent === null) {
      throw new Error('Handler deactivated')
    }
    // get an absolute position of the coordinate, so that it's a whole
    // board segment number.  By modulating the segment size, it makes
    // the value the remainder, so subtracting that means we're left with
    // a whole board position.  e.g. board size of 10, value 22: 22 % 10 = 2,
    // 22 - 2 = 20, which is a whole board size.
    // Modulo with negative numbers, though is different.  If width is 10, and
    // the first segment is at 0, then we should have segments at -10, 0, and 10.
    // For x == 8, 8 % 10 = 8 which means the segment x is 0 (8 - (8 % 10)).
    // However, for -8, it should be at -10, however -8 - (-8 % 10) is also 0.
    // Instead, we need to perform the right modulo calculation.

    const w = this.parent.board.segmentWidth
    const h = this.parent.board.segmentHeight

    let deltaX = x % w
    let deltaY = y % h
    if (deltaX < 0) {
      // For the example above, for w == 10, -8 % 10 == -8, but
      // we need to have it be 2, so that the x == -8 goes down
      // to the -10, the segment it belongs to.
      deltaX += w
    }
    if (deltaY < 0) {
      deltaY += h
    }

    return getAbsSegmentId(x - deltaX, y - deltaY)
  }

  // Should be considered a read-only view on the board.
  getGameBoard(): ClientGameBoard {
    if (this.parent === null) {
      throw new Error('Handler deactivated')
    }
    return this.parent.board
  }

  requestSegment(x: number, y: number, segmentId: string): void {
    if (this.parent === null) {
      throw new Error('Handler deactivated')
    }
    // Assume x/y are normalized.
    this.parent.loadSegment(segmentId, x, y)
  }

  markSegmentNotVisible(_segmentId: string): void {
    if (this.parent === null) {
      throw new Error('Handler deactivated')
    }
    // TODO FIXME
  }

  // Mark the game board token as in-flight.
  // TODO will eventually be replaced by the full API to send an event to the server
  //   for the end-of-turn token placement.
  markPlayedToken(
    _segmentId: string,
    _x: integer,
    _y: integer,
    _tiles: ClientTile[],
  ): void {
    if (this.parent === null) {
      throw new Error('Handler deactivated')
    }
    // TODO FIXME
  }

}
