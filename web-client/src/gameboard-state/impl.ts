// Manages the game board state

import { ClientGameBoard, TileParameterType, ClientTile, ClientGameBoardSegment } from './state'
import { GameBoardRequests, GameBoardStatusHandler } from './events'
import { HostApi } from '../server/api'
import { SegmentTile } from '../server/structs'
import { GameBoardManager } from './manager'


const EMPTY_TILE: ClientTile = {
  tokenId: null,
  category: null,
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

  loadSegment(x: integer, y: integer, width: integer, height: integer): Promise<SegmentTile[]> {
    return this.server.loadSegment(
      this.gameId,
      x,
      y,
      width,
      height,
    )
  }

  reportSegmentLoaded(segment: ClientGameBoardSegment) {
    this.board.segments[segment.segmentId] = segment
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
    x = x - (x % this.parent.board.segmentWidth)
    y = y - (y % this.parent.board.segmentHeight)

    // Negative numbers round the wrong direction.
    if (x < 0) {
      x -= this.parent.board.segmentWidth
    }
    if (y < 0) {
      y -= this.parent.board.segmentHeight
    }

    normalized[0] = x
    normalized[1] = y
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
    x = x - (x % this.parent.board.segmentWidth)
    y = y - (y % this.parent.board.segmentHeight)

    // Negative numbers round the wrong direction.
    if (x < 0) {
      x -= this.parent.board.segmentWidth
    }
    if (y < 0) {
      y -= this.parent.board.segmentHeight
    }

    return getAbsSegmentId(x, y)
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
    if (this.parent.board.segments[segmentId] === undefined) {
      // Assume x/y are normalized.
      const parent = this.parent
      const width = parent.board.segmentWidth
      const height = parent.board.segmentHeight

      this.parent.loadSegment(x, y, width, height)
        .then((serverTiles) => {
          const count = width * height
          const tiles: ClientTile[] = new Array<ClientTile>()
          for (let i = 0; i < count; i++) {
            tiles[i] = {
              ...EMPTY_TILE,
              parameters: {},
            }
          }
          serverTiles.forEach((serverTile) => {
            const tileIndex = (serverTile.x - x) + ((serverTile.y - y) * width)
            const tile = tiles[tileIndex]
            tile.category = serverTile.c
            tile.height = serverTile.h
            tile.tokenId = serverTile.t
            serverTile.p.forEach((param) => {
              tile.parameters[param.i] = param.q
            })
          })

          const segment: ClientGameBoardSegment = {
            segmentId,
            x,
            y,
            tiles,
          }
          parent.reportSegmentLoaded(segment)
        })
    }
  }

  markSegmentNotVisible(segmentId: string): void {
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
