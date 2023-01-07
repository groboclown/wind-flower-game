// Manages the game board state

import { ClientGameBoard, TileParameterType, ClientTile, ClientGameBoardSegment } from './state'
import { GameBoardRequests, GameBoardStatusHandler } from './events'
import { HostApi } from '../server/api'
import { nonnegativeRemainder } from '../lib/math'
import { GameBoardManager } from './manager'
import { CATEGORY_UNSET, CATEGORY_LOADING, CATEGORY_EMPTY, CATEGORY_PLACEABLE } from './asset-names'


const EMPTY_TILE: ClientTile = {
  tokenId: null,
  category: CATEGORY_UNSET,
  variation: 0,
  height: 0,
  parameters: {},

  tokenHexTileIndex: 0,

  vertexHeight: [0, 0, 0],
  vertexHeightSum: [0, 0, 0],
  vertexHeightCount: [0, 0, 0],
}

const LOADING_TILE: ClientTile = {
  tokenId: null,
  category: CATEGORY_LOADING,
  variation: 0,
  height: 0,
  parameters: {},

  // This value MUST be replaced when first created.
  tokenHexTileIndex: 0,

  // These values must be all set to 0.  Calculations
  // on incremental segment loading expect it.
  vertexHeight: [0, 0, 0],
  vertexHeightSum: [0, 0, 0],
  vertexHeightCount: [0, 0, 0],
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

  // Only used for finding the segment ID;
  //   The value is changed with each call, so it cannot be used outside
  //   a single request to that method.
  private tmpNormalizedPair: integer[]

  // Only used for finding adjacent tiles
  private tmpAdjacentTiles: (ClientTile | null)[]


  constructor(
    hostApi: HostApi,
    gameId: string,
    segmentWidth: integer,
    segmentHeight: integer,
    parameterTypes: TileParameterType[],
  ) {
    this.tmpNormalizedPair = [0, 0]
    this.tmpAdjacentTiles = [null, null, null, null, null, null, null, null, null]

    const paramMap: {[keys: integer]: TileParameterType} = {}
    parameterTypes.forEach((pt) => {
      paramMap[pt.key] = pt
    })

    this.server = hostApi
    this.gameId = gameId
    this.callbacks = []
    this.loadingSegments = {}
    this.board = {
      // TODO update the sizes from the server.
      boardWidth: Infinity,
      boardHeight: Infinity,
      boardMinX: -Infinity,
      boardMaxX: Infinity,
      boardMinY: -Infinity,
      boardMaxY: Infinity,

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
    const self = this

    // Mark that the loading is starting, so we don't have multiple of these in-flight.
    self.loadingSegments[segmentId] = true

    // Because this is now loading, we must mark the tiles as loading before
    // the async stuff starts.  That means this call allocates memory before the
    // promise returns.

    // This also needs to keep track of tiles that are empty, and make
    // sure after a server load, that those tiles are replaced with empty tokens.

    const width = self.board.segmentWidth
    const height = self.board.segmentHeight
    const count = width * height
    const tiles: ClientTile[] = new Array<ClientTile>()
    const emptyServerTiles: {[keys: integer]: integer} = {}
    let col = x
    const lastCol = x + width
    let row = y
    for (let i = 0; i < count; i++) {
      tiles[i] = {
        ...LOADING_TILE,

        // One time hex tile index discovery.
        tokenHexTileIndex: getHexTileIndex(col, row),

        // Non-scalar values must be new objects; without this,
        //   they are just pointers to existing objects.
        parameters: {},
        vertexHeight: [0, 0, 0],
        vertexHeightSum: [0, 0, 0],
        vertexHeightCount: [0, 0, 0],
      }
      emptyServerTiles[i] = i
      col++
      if (col >= lastCol) {
        col = x
        row++
      }
    }
    const segment: ClientGameBoardSegment = {
      segmentId,
      x,
      y,
      tiles,
    }
    self.board.segments[segmentId] = segment

    // Because the board state changed, the board load ID must change.
    self.board.loadId++

    // However, the load hasn't happened, so the report loading isn't called yet.

    // Start the asynchronous, waiting code.
    const serverTiles = await self.server.loadSegment(
      self.gameId,
      x,
      y,
      width,
      height,
    )

    // The server returns the tiles with data in them.
    // This model stores a segment fully populated to make
    // index work quickly.  That means the tiles must be
    // created empty, and filled in based on the server response.

    const tileAddrCache: {[keys: string]: ClientTile | null} = {}

    // Load in tiles from the server response into the segment grid.
    serverTiles.segments.forEach((serverTile) => {
      const tileIndex = (serverTile.x - x) + ((serverTile.y - y) * width)
      delete emptyServerTiles[tileIndex]
      const tile = tiles[tileIndex]
      tile.category = serverTile.c
      tile.height = serverTile.h
      tile.tokenId = serverTile.t
      // Copy the parameters into the already allocated map.
      serverTile.p.forEach((param) => {
        tile.parameters[param.i] = param.q
      })

      // Because this tile is just loaded, the height will be completely refreshed.
      // If something tried loading height into it before, we'll reset that.
      for (let i = 0; i < 3; i++) {
        tile.vertexHeightSum[i] = 0
        tile.vertexHeightCount[i] = 0
        tile.vertexHeight[i] = 0
      }
    })

    // Clean up empty tiles.
    Object.values(emptyServerTiles).forEach((tileIndex) => {
      const tile = tiles[tileIndex]
      tile.category = CATEGORY_EMPTY
    })

    // Now that all the tiles are loaded, perform inspection.
    let tileX = segment.x
    const maxTileX = segment.x + width
    let tileY = segment.y
    for (let tileIdx = 0; tileIdx < segment.tiles.length; tileIdx++) {
      const tile = segment.tiles[tileIdx]

      // Find the adjacent token's tiles.  If any are non-null, and we
      //   constructed the board right, then all the tiles are non-null.
      // Because this is a token from the server, the category shouldn't
      //   be null, so it doesn't matter the value of this token's adjacent
      //   count value.
      self.populateAdjacentTilesTo(
        tileX, tileY, tile.tokenHexTileIndex, tileAddrCache, self.tmpAdjacentTiles
      )
      if (tile.category !== CATEGORY_EMPTY && tile.category !== CATEGORY_PLACEABLE) {
        for (let i = 0; i < 6; i++) {
          const other = self.tmpAdjacentTiles[i]
          // Should be able to test this outside the loop, but edges can have null,
          //   so, edge case on edges.
          if (other !== null && other.category === CATEGORY_EMPTY) {
            other.category = CATEGORY_PLACEABLE
          }
        }
      }

      // Find the surrounding tiles for the 3 verticies to calculate the height.
      const vertexPointsRel = TILE_VERTEX_INDEX_ADJACENT[tile.tokenHexTileIndex]
      for (let vIdx = 0; vIdx < 3; vIdx++) {
        // Each vertex has 3 tiles that impact the height.
        for (let i = 0; i < 3; i++) {
          const relPos = vertexPointsRel[vIdx][i]
          if (relPos.length === 0) {
            tile.vertexHeightSum[vIdx] += tile.height
            tile.vertexHeightCount[vIdx]++
          } else {
            const other = self.getTileAt(tileX + relPos[0], tileY + relPos[1], tileAddrCache)
            if (other !== null) {
              tile.vertexHeightSum[vIdx] += other.height
              tile.vertexHeightCount[vIdx]++
            }
          }
        }
        // tile.vertexHeightACount should always be non-zero.
        tile.vertexHeight[vIdx] = tile.vertexHeightSum[vIdx] / tile.vertexHeightCount[vIdx]
      }

      // Push this height into the adjacent 4 tiles of the shared vertex.
      // Note that, due to the height reset that's done after a tile load, this really
      //   only has an impact on tiles along the edges of adjacent segments, and on
      //   segments that were loaded before this one was loaded in the current segment.
      const otherTilesVertexRel = TILE_VERTEX_INDEX_ADJUSTS_ADJACENT[tile.tokenHexTileIndex]
      for (let tIdx = 0; tIdx < 4; tIdx++) {
        const tileVertexRel = otherTilesVertexRel[tIdx]
        const other = self.getTileAt(tileX + tileVertexRel[0], tileY + tileVertexRel[1], tileAddrCache)
        if (other !== null) {
          const vIdx = tileVertexRel[2]
          other.vertexHeightSum[vIdx] += tile.height
          other.vertexHeightCount[vIdx]++
          other.vertexHeight[vIdx] = other.vertexHeightSum[vIdx] / other.vertexHeightCount[vIdx]
        }
      }

      // End of loop increment.
      tileX++
      if (tileX >= maxTileX) {
        tileX = segment.x
        tileY++
      }
    }

    // The board state just changed again, so update the load id.
    self.board.loadId++
    // And mark the segment as no longer loading
    delete self.loadingSegments[segmentId]

    // Now we can report the segment as loaded.
    self.callbacks.forEach((cb) => {
      try {
        cb.handler.onSegmentLoaded(segment.x, segment.y, segment.segmentId)
      } catch (e) {
        console.log(e)
      }
    })
  }

  // populateNormalizedSegmentPosition get an absolute position of the coordinate, so that it's a whole board segment number
  populateNormalizedSegmentPosition(x: integer, y: integer, normalized: integer[]): void {
    // By modulating the segment size, it makes
    // the value the remainder, so subtracting that means we're left with
    // a whole board position.  e.g. board size of 10, value 22: 22 % 10 = 2,
    // 22 - 2 = 20, which is a whole board size.
    // Modulo with negative numbers, though is different.  If width is 10, and
    // the first segment is at 0, then we should have segments at -10, 0, and 10.
    // For x == 8, 8 % 10 = 8 which means the segment x is 0 (8 - (8 % 10)).
    // However, for -8, it should be at -10, however -8 - (-8 % 10) is also 0.
    // Instead, we need to perform the right modulo calculation.

    const w = this.board.segmentWidth
    const h = this.board.segmentHeight

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

  // getSegmentId get the segment ID string for the segment containing the x/y pair
  getSegmentId(x: integer, y: integer): string {
    this.populateNormalizedSegmentPosition(x, y, this.tmpNormalizedPair)
    return getAbsSegmentId(this.tmpNormalizedPair[0], this.tmpNormalizedPair[1])
  }


  // getTileAt get the tile at the given coordinates.
  //   If the tile is for a not loaded segment, then a null is returned.
  //   Forcing the tile to be loaded would lead to a cascade of loading
  //   everything in memory, which we don't want.
  private getTileAt(
      x: integer, y: integer, cache: {[keys: string]: ClientTile | null},
  ): ClientTile | null {
    const key = `${x}/${y}`
    let ret = cache[key]
    if (ret !== undefined) {
      return ret
    }
    this.populateNormalizedSegmentPosition(x, y, this.tmpNormalizedPair)
    const segmentId = getAbsSegmentId(this.tmpNormalizedPair[0], this.tmpNormalizedPair[1])
    const segment = this.board.segments[segmentId]
    if (segment === undefined) {
      return null
    }
    const relCol = x - this.tmpNormalizedPair[0]
    const relRow = y - this.tmpNormalizedPair[1]
    const tileIndex = relCol + (relRow * this.board.segmentWidth)
    ret = segment.tiles[tileIndex]
    if (ret === undefined) {
      cache[key] = null
      return null
    }
    cache[key] = ret
    return ret
  }


  // populateAdjacentTilesTo fills in targetAdjacent with the 6 tiles in the token adjacent to this tile
  //   Note that it's possible to compute the hex index here, but it should already be
  //   computed before calling.
  private populateAdjacentTilesTo(
    x: integer, y: integer, hexTileIndex: integer,
    cache: {[keys: string]: ClientTile | null},
    targetAdjacent: (ClientTile | null)[]
  ) {
    const relVerts = TILE_HEX_INDEX_ADJACENT[hexTileIndex]
    for (let i = 0; i < 6; i++) {
      const relPos = relVerts[i]
      targetAdjacent[i] = this.getTileAt(x + relPos[0], y + relPos[1], cache)
    }
  }


}


function getHexTileIndex(absX: integer, absY: integer): integer {
  const col6 = nonnegativeRemainder(absX, 6)
  const row2 = nonnegativeRemainder(absY, 2)
  if (col6 >= 3) {
    // odd token.
    return (col6 - 3) + ((1 - row2) * 3)
  }
  return col6 + (row2 * 3)
}



// As an optimization, the gameboard drawing relies on the gameboard state
// to store one-time computations.  The two must be tightly integrated on
// these values to make the gameboard rendering fast.

// We must compute the adjacent triangle/token for each point
// on a triangle in the token.  This is used for "is there an adjacent tile"
// computations, and for getting the average height for each vertex.
// If we look at the points on the hexagon:
//
//         P0 ______________ P1
//           /\            /\
//          /  \  T(1, 0) /  \
//         /    \        /    \
//        /      \      /      \
//       /        \    /        \
//      / T(0, 0)  \  /  T(2, 0) \
//  P2 / ________P3 \/_________P4 \
//     \            /\            /
//      \ T(0, 1)  /  \  T(2, 1) /
//       \        /    \        /
//        \      /      \      /
//         \    /        \    /
//          \  / T(1, 1)  \  /
//       P5  \/____________\/ P6
//
// Each of these points joins 3 hexagons, 2 triangles each except the center point.
// We can create a reverse tile to hex mapping to find which specific triangle in the
// hexagon we're inspecting, then use a lookup table to get the relative index positions
// for the other 2 tiles to average.
//
// This means that each triangle has 2 points shared with other tokens, plus a third
// (the triangle's token itself).  Each point is shared with at least 1 other triangle
// in the hexagon token (P3 is shared with all the triangles).

// If we look at how the hexagons join to each other, we see the grid layout:

//  H(A)                 |            H(B)             |        H(C)
//            | T(2, 0)  | T(0, 1) | T(1, 1) | T(2, 1) |  T(0, 0) |
//            +----------X=========+=========+=========X----------+
//            | T(2, 1) || T(0, 0) | T(1, 0) | T(2, 0) || T(0, 1) |
//  ----------+---------||---------+---------+---------||---------+--------------
//            | T(2, 0) || T(0, 1) | T(1, 1) | T(2, 1) || T(0, 0) |
//            +----------X=========+=========+=========X----------+
//            | T(2, 1)  | T(0, 0) | T(1, 0) | T(2, 0) |  T(0, 1) |
//  H(D)                 |            H(E)             |       H(F)

// Based on this layout, each tile has 1 adjacent token, and 2 outside verticies.
// Additionally, each of the verticies is associated with three tokens.
// When a non-empty tile is loaded from the server, that loading must, for each tile:
//   1. Update the corresponding adjacent token's tiles (all 6) to indicate that it has an
//      adjacent token.  This only needs to happen for null category (nothing placed) tiles.
//   2. Update the adjacent token's height values for the verticies.
//   3. Read the adjacent token's height values to set the new tile's height.
// When a token is updated from the server (due to tokens having been played in other
// turns), the update must, for each tile:
//   1. Update the corresponding adjacent token's tiles (all 6) to indicate that it has an
//      adjacent token.  As a token can only be placed on a location at most once, we don't
//      need to worry about checking if it's already been placed.  Just increment the value.
//      This only needs to happen if the tile's category is null (nothing placed).
//   2. Update the adjacent token's height values for the verticies.
//   3. Read the adjacent token's height values to set the new tile's height.
// For the vertex height adjustment, The computation must:
//   a. Load 2 adjacent tiles for vertex A (one per token).  For each one, if the category
//      is non-null, add its height to the vertex A height.  Add in the current tile's height (if non-null).
//      Set the vertex A count to the non-null count.
//   b. Do the same thing for vertex B.
// Vertex A and B in this must line up with the drawing algorithm's ordering for the verticies.
// The ordering is this:
//   Odd Triangle:
//     C --- B
//       \ /
//        . A
//   Even triangle:
//        . A
//     B /_\ C


// TILE_VERTEX_HEIGHT_ADJACENT the vertex in the corresponding adjacent tile that is affected
//    by this tile's height.  Each tile in the hex affects a single vertex for ajoining tiles
//    in other tokens; this finds the tile positions for those ajoining tiles.  The next
//    lookup (TILE_VERTEX_HEIGHT_ADJACENT_VERTEX) maps the vertex in those tiles.
//    Each item is the (rel x, rel y, vertex index for that rel tile)
// Use with: TILE_VERTEX_INDEX_ADJUSTS_ADJACENT[hex index][vertex index]
const TILE_VERTEX_INDEX_ADJUSTS_ADJACENT: integer[][][] = [
  // Tile Hex Index 0; shares P0
  [
    // shared with H(A):T(2,0)[C] and H(A):T(2,1)[B] and H(B):T(0, 1)[A] and H(B):T(1,1)[B]
    [-1, -1, 2], [-1, 0, 1], [0, -1, 0], [1, -1, 1],
  ],

  // Tile Hex Index 1; shares P1
  [
    // shared with H(B):T(1,1)[C] and H(B):T(2,1)[A] and H(C):T(0,0)[B] and H(C):T(0,1)[C]
    [0, -1, 2], [1, -1, 0], [2, -1, 1], [2, 0, 2],
  ],

  // Tile Hex Index 2; shares P4
  [
    // shared with H(C):T(0,1)[A] and H(C):T(1,1)[B] and H(F):T(0,0)[A] and H(F):T(1,0)[C]
    [1, 0, 0], [2, 1, 1], [1, 1, 0], [2, 1, 2],
  ],

  // Tile Hex Index 3; shares P2
  [
    // shared with H(A):T(1,1)[C] and H(A):T(2,1)[A] and H(D):T(1,0)[B] and H(D):T(2,0)[A]
    [-2, -1, 2], [-1, -1, 0], [-2, 0, 1], [-1, 0, 0],
  ],

  // Tile Hex Index 4; shares P5
  [
    // shared with H(D):T(2,0)[C] and H(D):T(2,1)[B] and H(E):T(0,0)[A] and H(E):T(1,0)[C]
    [-2, 0, 2], [-2, 1,1], [-1, 1, 0], [0, 1, 2],
  ],

  // Tile Hex Index 5; shares P6
  [
    // shared with H(E):T(1,0)[B] and H(E):T(2,0)[A] and H(F):T(0,0)[B] and H(F):T(0,1)[C]
    [-1, 1, 1], [0, 1, 0], [1, 0, 1], [1, 1, 2],
  ],
]


// TILE_VERTEX_INDEX_ADJACENT x/y offsets to a tile in one of the vertex adjacent tiles.
//    Within each hex offset, there's the list of x/y offsets for the set of tiles that
//    add up the vertex height.
// A lookup here is:
//  TILE_VERTEX_INDEX_ADJACENT[hex index][vertex index][tile number][x or y]
// Where:
//  - hex index is 0 to 5 (hex index in the token)
//  - vertex index: 0 == A, 1 == B, 2 == C
//  - tile number: adjacent token tile 0, 1, or 2
//  - x or y: 0 for x offset, 1 for y offset.  If this array is empty, then it refers to the current tile.
// Where possible, the corresponding token height is taken from the same tile, so that
//   it can be quickly looked up.
// Need to check the performance here, to see if index lookup calculations would be faster.
const TILE_VERTEX_INDEX_ADJACENT: integer[][][][] = [
  // Tile Hex Index 0
  [
    // Vertex A (P0 :: H(A):T(2,1), H(B):T(0,1))
    [[-1, 0], [0, -1], []],
    // Vertex B (P2 :: H(A):T(2,1), H(D):T(2,1))
    [[-1, 0], [-1, 1], []],
    // Vertex C (P3)
    [[], [], []],
  ],

  // Tile Hex Index 1
  [
    // Vertex A (P3)
    [[], [], []],
    // Vertex B (P1 :: H(B):T(0,1), H(C):T(0,1))
    [[-1, -1], [2, 0], []],
    // Vertex C (P0 :: H(A):T(2,1), H(B):T(0,1))
    [[-2, 0], [-1, -1], []],
  ],

  // Tile Hex Index 2
  [
    // Vertex A (P1 :: H(B):T(0,1), H(C):T(0,1))
    [[-2, -1], [1, 0], []],
    // Vertex B (P3)
    [[], [], []],
    // Vertex C (P4 :: H(C):T(0,1), H(F):T(0,0))
    [[1, 0], [1, 1], []],
  ],

  // Tile Hex Index 3
  [
    // Vertex A (P5 :: H(D):T(2,0), H(E):T(0,0))
    [[-1, 0], [0, 1], []],
    // Vertex B (P3)
    [[], [], []],
    // Vertex C (P2 :: H(A):T(2,1), H(D):T(2,1))
    [[-1, 0], [-1, -1], []],
  ],

  // Tile Hex Index 4
  [
    // Vertex A (P3)
    [[], [], []],
    // Vertex B (P5 :: H(D):T(2,0), H(E):T(0,0))
    [[-2, 0], [-1, 1], []],
    // Vertex C (P6 :: H(E):T(0,0), H(F):T(0,0))
    [[-1, 1], [2, 0], []],
  ],

  // Tile Hex Index 5
  [
    // Vertex A (P6 :: H(E):T(0,0), H(F):T(0,0))
    [[-2, 1], [1, 0], []],
    // Vertex B (P4 :: H(C):T(0,1), H(F):T(0,0))
    [[1, -1], [1, 0], []],
    // Vertex C (P3)
    [[], [], []],
  ],
]

// TILE_HEX_INDEX_ADJACENT x/y offset to get the tiles in the token that is "adjacent" to the current tile.
// The static list here is (hex index) -> adjacent token tile x/y offset
const TILE_HEX_INDEX_ADJACENT: integer[][][] = [
  // Tile Hex Index 0 -> H(A)
  [[-3, -1], [-2, -1], [-1, -1], [-3, 0], [-2, 0], [-1, 0]],

  // Tile Hex Index 1 -> H(B)
  [[-1, -2], [0, -2], [1, -2], [-1, -1], [0, -1], [1, -1]],

  // Tile Hex Index 2 -> H(C)
  [[1, -1], [2, -1], [3, -1], [1, 0], [2, 0], [3, 0]],

  // Tile Hex Index 3 -> H(D)
  [[-3, 0], [-2, 0], [-1, 0], [-3, 1], [-2, 1], [-1, 1]],

  // Tile Hex Index 4 -> H(E)
  [[-1, 1], [0, 1], [1, 1], [-1, 2], [0, 2], [1, 2]],

  // Tile Hex Index 5 -> H(F)
  [[1, 0], [2, 0], [3, 0], [1, 1], [2, 1], [3, 1]],
]



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
    this.parent.populateNormalizedSegmentPosition(x, y, normalized)
  }

  getSegmentId(x: integer, y: integer): string {
    if (this.parent === null) {
      throw new Error('Handler deactivated')
    }
    return this.parent.getSegmentId(x, y)
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
