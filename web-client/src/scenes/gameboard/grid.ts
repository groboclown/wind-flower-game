// Manage the grid mesh.
import { THREE, ExtendedMesh, ExtendedObject3D } from 'enable3d'
import { TextureHandler } from './texture-handler'
import {
  GameBoardManager,
  ClientTile,
  GameBoardRequests,
  GameBoardStatusHandler,
  ClientGameBoardSegment,
  CATEGORY_LOADING,
} from '../../gameboard-state'
import { nonnegativeRemainder } from '../../lib/math'


export const EMPTY_SEGMENT_ID = ""


// IntersectedTokenTile data holder to identify a ray cast to the game board interseting a token
// Outside this file, users should consider this object to be obsure except for
// the `tokenId` value, which will equal null if no token was intersected.
export interface IntersectedTokenTile {
  // These are pointers to the tile itself.
  tokenTile0: ClientTile | null
  tokenTile1: ClientTile | null
  tokenTile2: ClientTile | null
  tokenTile3: ClientTile | null
  tokenTile4: ClientTile | null
  tokenTile5: ClientTile | null
  gridIndex0: integer
  gridIndex1: integer
  gridIndex2: integer
  gridIndex3: integer
  gridIndex4: integer
  gridIndex5: integer
  segmentId: string // === EMPTY_SEGMENT_ID for not intersected.
  tokenId: integer | null
}


export function createIntersectedTokenTile(): IntersectedTokenTile {
  return {
    tokenTile0: null,
    tokenTile1: null,
    tokenTile2: null,
    tokenTile3: null,
    tokenTile4: null,
    tokenTile5: null,
    gridIndex0: 0,
    gridIndex1: 0,
    gridIndex2: 0,
    gridIndex3: 0,
    gridIndex4: 0,
    gridIndex5: 0,
    segmentId: EMPTY_SEGMENT_ID,
    tokenId: null,
  }
}


export interface TileMode {
  hoverOver: boolean
  selected: boolean
}


// This data is stored one per tile in the grid.
// It needs to be small and efficient.  However, it's created
// just once per game.
interface GridTileInfo {
  // Tile lookup:
  segmentId: string
  x: integer  // absolute, in tiles
  y: integer  // absolute, in tiles

  // Index of the tile within the segment.
  tileIndex: integer

  // The tile's vertex index in geometry's buffer arrays.
  vertexA: integer
  vertexB: integer
  vertexC: integer

  // The hexagon tile position
  hexIndex: integer
  hexColumn: integer
  hexRow: integer
}



// Each tile in each segment is an equalateral triangle.
// Each triangle is either even or odd, based on the calculation:
//   odd_ness = (x + y) & 0x1
// With this setup (labeled for the right-hand rule):
//   Odd Triangle:
//     C --- B
//       \ /
//        . A
//   Even triangle:
//        . A
//     B /_\ C

// We arrange even/odd this way so that the grid layout for a single
// hexagon:
//    +-----+-----+-----+
//    | 0,0 | 1,0 | 2,0 |
//    +-----+-----+-----+
//    | 0,1 | 1,1 | 2,1 |
//    +-----+-----+-----+
// will line up with the tiles, to turn into:
//      +-------+
//     / \     / \
//    / A \ B / C \
//   /     \ /     \
//  +-------+-------+
//   \     / \     /
//    \ D / E \ F /
//     \ /     \ /
//      +-------+

// In both cases, the x/y values are the same, but the y values
// are inverted.  If the y values are inverted, the order of the
// vertices must be also swapped to maintain the right-hand rule
// for the normal.

// 30-60-90 triangle:
//  hyp length == 1
//  adj length == 1/2
//  opp length == sqrt(3) / 2

const SIDE_LENGTH = 1.0
const SIDE_LENGTH_HALF = SIDE_LENGTH / 2.0
const SLOPE = 1.0 / Math.sqrt(3.0)
const BASE_LENGTH = SIDE_LENGTH_HALF * Math.sqrt(3.0)
const HEIGHT_SCALE = 0.2
const EMPTY_TILE_HEIGHT = -5

const UPDATE_GRID_RATIO = 0.8



// Grid3d the 3d object generator and data handler for the grid.
//
// The lookup needs to maintain a way to find segment tiles based on
// screen position, and find vertex positions based on tiles.
//
// The grid is a fixed size based on the visible radius.  As the user
// moves, the triangles are swapped out.
//
// Because the tiles on the x/z plane are always going to remain the same relative
// position (if they move, all 3 points on the triangle all move by the same value),
// they can all be calculated up-front.  Only the y, u/v, and normal need recalculating.
export class Grid3d {
  // Information loaded outside this grid, and static for the life of the
  //   grid.
  private textureHandler: TextureHandler
  private boardReq: GameBoardRequests
  private boardManager: GameBoardManager
  private boardHandler: GameBoardStatusHandler
  private segmentManager: SegmentManager

  private visibleWidth: integer
  private visibleHeight: integer

  private lastGridLoadId: integer


  // Singleton data objects, reused during the calls.
  // Keeping them allocated saves time by not needing to recreate them or free them.
  private raycaster: THREE.Raycaster
  private coords: { x: number, y: number }
  private tilePositionCache: number[]

  // The grid stores 1 THREE object, which contains 0 or more segments.
  private object: ExtendedObject3D | null
  private geometry: THREE.BufferGeometry
  private pA: THREE.Vector3
	private pB: THREE.Vector3
	private pC: THREE.Vector3
  private cb: THREE.Vector3
  private ab: THREE.Vector3

  // Where the camera is looking at, based on a tile position.
  // This is a token position.  It's considered the center of the viewable grid.
  private targetTilePositionColumn: integer
  private targetTilePositionRow: integer

  // The code needs to be able to translate from a tile in a segment to vertex information,
  //   and back the other way.
  private gridTiles: GridTileInfo[]

  // for the given vertex index in the array, the value is the index in the gridTiles list.
  // TODO for some memory optimization, this could be vertex index / 3, because every 3 has
  //   the same grid tile index.
  private vertexIndexToGridTileIndex: Uint32Array

  // for the given token ID, get the grid tiles with that token ID.
  private tokenIdToSegmentTileIndex: {[key: integer]: integer[]}

  // Looks up a grid tile index by the tile's [row][col] coordinates
  //    Note how this lookup is backwards from the usual nomenclature of col/row.
  private tilePosGridTileIndex: {[keys: integer]: {[keys: integer]: integer}}

  // The tokenId -> UV texture mode.
  //    The rendering for the alternate modes is done here.
  private tokenIdModes: {[keys: integer]: TileMode}


  constructor(
    boardManager: GameBoardManager,
    texture: THREE.Texture,
    bump: THREE.Texture,
    textureHandler: TextureHandler,
    visibleWidth: integer,   // in tiles, not tokens
    visibleHeight: integer,  // in tiles, not tokens

    // initial tile the client looks at
    //   Note: the server tells the client where the player's starting
    //   position is based on tile position.  It might be negative.
    targetTilePositionColumn: integer,
    targetTilePositionRow: integer,
  ) {
    // -----------------------------
    // Argument Value Adjustments
    // Need to ensure that height wise we always show at least 2
    // full tokens, for one above and one below.  This makes target adjustment
    // easier by moving a complete token along the z axis.
    // A token is 2 tiles tall, so that means the height must be at least 6 tall
    // (2 + 1) and increments of 2.
    visibleHeight = Math.max(6, visibleHeight - (visibleHeight % 2) + 2)
    // Width wise, we want to have it be at least 2 complete tokens
    // so that the segment loading and the token adjustment is easier.
    visibleWidth = Math.max(9, visibleWidth - (visibleWidth % 3) + 3)

    // Make sure the target points at the start of a token.
    targetTilePositionColumn = targetTilePositionColumn - nonnegativeRemainder(targetTilePositionColumn, 3)
    targetTilePositionRow = targetTilePositionRow - nonnegativeRemainder(targetTilePositionRow, 2)
    if (nonnegativeRemainder(targetTilePositionColumn, 6) >= 3) {
      // Odd token column, so row is offset.
      targetTilePositionRow++
    }

    const triangleCount = visibleWidth * visibleHeight


    // -----------------------------
    // Property Initialization
    const self = this

    this.tokenIdModes = {}
    this.boardManager = boardManager
    this.boardHandler = {
      onSegmentLoaded: (x: integer, y: integer, segmentId: string) => {
        self.onGameBoardSegmentLoaded(x, y, segmentId)
      },
      onSegmentUpdated: (x: integer, y: integer, segmentId: string, tileIndicies: integer[]) => {
        self.onGameBoardSegmentUpdated(x, y, segmentId, tileIndicies)
      },
      onSegmentRemoved: (x: integer, y: integer, segmentId: string) => {
        self.onGameBoardSegmentRemoved(x, y, segmentId)
      },
    }
    this.boardReq = boardManager.registerHandler(this.boardHandler)
    this.lastGridLoadId = this.boardReq.getGameBoard().loadId
    this.segmentManager = new SegmentManager(this.boardReq)

    this.targetTilePositionColumn = targetTilePositionColumn
    this.targetTilePositionRow = targetTilePositionRow

    this.textureHandler = textureHandler
    this.visibleWidth = visibleWidth
    this.visibleHeight = visibleHeight

    this.raycaster = new THREE.Raycaster()
    this.coords = { x: 0, y: 0 }

    this.pA = new THREE.Vector3()
    this.pB = new THREE.Vector3()
    this.pC = new THREE.Vector3()
    this.cb = new THREE.Vector3()
    this.ab = new THREE.Vector3()

    this.tilePositionCache = [0, 0]

    // Construct the basic grid information.
    // The grid will be populated with real data later.
    // For the initialization, we just need to allocate the data.
    this.gridTiles = new Array<GridTileInfo>(triangleCount)
    this.vertexIndexToGridTileIndex = new Uint32Array(3 * triangleCount)
    this.tilePosGridTileIndex = {}
    this.tokenIdToSegmentTileIndex = {}

    let vertex = 0
    for (let tileIndex = 0; tileIndex < triangleCount; tileIndex++) {
      this.gridTiles[tileIndex] = {
        segmentId: EMPTY_SEGMENT_ID,
        x: 0,
        y: 0,
        tileIndex,
        vertexA: vertex++,
        vertexB: vertex++,
        vertexC: vertex++,
        hexIndex: 0,
        hexColumn: 0,
        hexRow: 0,
      }
    }

    // ----------------------------------------
    // Basic planar position (x/z values)
    const normals = new Float32Array(3 * 3 * triangleCount)
    const uv = new Float32Array(2 * 3 * triangleCount)
    const positions = new Float32Array(3 * 3 * triangleCount)

    // ---------------------------------
    // Basic object construction.

    this.geometry = new THREE.BufferGeometry()
    const positionAttrib = new THREE.BufferAttribute(positions, 3)
    positionAttrib.setUsage(THREE.DynamicDrawUsage)
    this.geometry.setAttribute('position', positionAttrib)
    const normalAttrib = new THREE.BufferAttribute(normals, 3)
    normalAttrib.setUsage(THREE.DynamicDrawUsage)
    this.geometry.setAttribute('normal', normalAttrib)
    const uvAttrib = new THREE.Float32BufferAttribute(uv, 2)
    uvAttrib.setUsage(THREE.DynamicDrawUsage)
    this.geometry.setAttribute('uv', uvAttrib)

    // MeshPhysicalMaterial
    // MeshStandardMaterial - slowest/highest quality
    // MeshPhongMaterial
    // MeshLambertMaterial
    // MeshBasicMaterial - fastest/lowest quality
    const material = new THREE.MeshPhongMaterial({
      map: texture,
      bumpMap: bump,
      bumpScale: 0.1,
      // specular: 0xaaaaaa,
      // shininess: 250,
      // metalness: 0.5,
      blending: 1,
      side: THREE.DoubleSide,
    })

    const mesh = new ExtendedMesh(this.geometry, material)
    this.object = new ExtendedObject3D()
    this.object.add(mesh)
  }


  // dispose close this object.
  dispose() {
    this.boardManager.removeHandler(this.boardHandler)

    this.object?.removeFromParent()
    this.geometry.dispose()
    this.object = null
  }


  // getObjects Get the 3d object list to add to the scene.
  getObjects(): ExtendedObject3D[] {
    if (this.object === null) {
      return []
    }
    return [this.object]
  }


  // checkForUpdate Called to, once a tick, see if loads need to be displayed.
  checkForUpdate() {
    // For now, just update the whole grid when the board updates.
    if (this.lastGridLoadId !== this.boardReq.getGameBoard().loadId) {
      this.updateGrid()
    }
  }


  getBoardBounds(): {minRow: number, minCol: number, maxRow: number, maxCol: number} {
    const board = this.boardReq.getGameBoard()
    return {
      minCol: board.boardMinX,
      minRow: board.boardMinY,
      maxCol: board.boardMaxX,
      maxRow: board.boardMaxY,
    }
  }


  // getTargetAtTile populate the target value with the x/z position of the tile
  // The column/row is the absolute position, independent of segments.
  // The height is set to 0, not the height of the tile (which may not be loaded yet).
  populateTargetAtTile(column: integer, row: integer, target: THREE.Vector3) {
    // Target 0,0 points at the center of the zero token, which is 1 whole side length long and
    // one base length below the top of the tile at 0,0.
    target.set(
      // Column triangles overlap.  Because this is the center of the triangle,
      //   the height doesn't need to take even/odd position into account.
      (column * SIDE_LENGTH_HALF) + SIDE_LENGTH,
      0,  // Ignore height
      // Rows do not overlap.  Likewise, they don't need to take the token
      //   row offset into account, because this is tile based in the call.
      (row * BASE_LENGTH) - BASE_LENGTH,
    )
  }


  // populateSimplifiedTileAtTarget a simplified calculation that's fast but not accurate
  // The tilePos must be pre-allocated as an array of at least (startIndex + 2) values.
  // This is a simplified calculation and is exactly right only half the time; otherwise
  // the column is off by 1 in either direction.
  // Use populateTileAtTarget for an accurate computation.
  populateSimplifiedTileAtTarget(target: THREE.Vector3, tilePos: integer[], startIndex: integer = 0) {
    tilePos[startIndex] = (target.x / SIDE_LENGTH_HALF) | 0
    tilePos[startIndex + 1] = (target.z / BASE_LENGTH) | 0
  }


  // populateTileAtTarget fills in the tilePos double with the tile column/row at the target position
  // The tilePos must be pre-allocated as an array of at least (startIndex + 2) values.
  // This is a precision calculation, and takes more computation than the rough one.
  populateTileAtTarget(target: THREE.Vector3, tilePos: integer[], startIndex: integer = 0) {
    // This is kind of an inverse of the above target <- tile calculation.
    // However, it must be accurate for per tile, not per token, discovery.

    // The z position -> row is simple.
    //   This rounds down, which is right - between the start and the end is all within the same tile.
    //   The incremental between the floor(z / B) is delta-z.  This is used in the column
    //   calculation below.
    const rowPos: number = target.z / BASE_LENGTH
    const row: integer = rowPos | 0
    tilePos[startIndex + 1] = row
    const deltaZ: number = rowPos - row

    // The x position is more complex, as we need to look at the triangle angle.
    // Zero is an even triangle, so looking at the same row:
    //   .____.____.
    //  /0\ 1/2\ 3/
    // /___\/___\/
    // Along the column, we can find the 2 triangles the point could be in by
    // examining the x distance.  Each bar between the dots is 1 side length.

    // We'll translate the x into tile coordinates.
    // There are several possibilities for the column; column 0 is the base
    // we'll use for the computations.
    const colPos: number = target.x / SIDE_LENGTH
    const col0: integer = colPos | 0
    const deltaX: number = colPos - col0

    // For this grid configuration, it's an even-odd pair if the col0 is an
    //   even triangle.
    if (((row + col0) & 0x1) === 0) {
      // We're looking at this setup:
      //       1/2
      //        ._______.
      //       / \     /
      //      /   \   /
      //     /     \ /
      //    ._______.
      //   0         1

      // If delta-x is <= 1/2, then we're looking at the incline slope.
      if (deltaX <= 0.5) {
        // The line algorithm here is: (delta-z * slope).  If the delta-x
        // is less than that, then it's at the triangle before col0 (col0 - 1).
        // Else, it's the col0 triangle.
        if (SLOPE * deltaZ <= deltaX) {
          tilePos[startIndex] = col0 - 1
        } else {
          tilePos[startIndex] = col0
        }
      } else {
        // The line algorithm here is: (1 - delta-z * slope)  If the delta-x
        // is less than that, then it's at col0.
        // Else, it's at the col0 + 1 triangle.
        if (1 - (SLOPE * deltaZ) <= deltaX) {
          tilePos[startIndex] = col0
        } else {
          tilePos[startIndex] = col0 + 1
        }
      }
    } else {
      // We're looking at this setup:
      //  -1/2     1/2
      //   ._______.
      //    \     / \
      //     \   /   \
      //      \ /     \
      //       ._______.
      //      0         1

      // If deta-x is <= 1/2, then we're looking at a decline slope.
      if (deltaX <= 0.5) {
        if (1 - (SLOPE * deltaZ) <= deltaX) {
          tilePos[startIndex] = col0 - 1
        } else {
          tilePos[startIndex] = col0
        }
      } else {
        // It's an incline slope.
        if (SLOPE * deltaZ <= deltaX) {
          tilePos[startIndex] = col0
        } else {
          tilePos[startIndex] = col0 + 1
        }
      }
    }
  }


  // updateTarget the target moved, so the grid might need an update.
  updateGridAtTarget(cameraTarget: THREE.Vector3, force: boolean = false) {
    if (this.object === null) {
      return
    }

    const prevTargetColumn = this.targetTilePositionColumn
    const prevTargetRow = this.targetTilePositionRow

    // We don't need an accurate computation to determine the new target position.
    // A rough one is sufficient, because we're finding it based on the nearest hexagon token.
    this.populateSimplifiedTileAtTarget(cameraTarget, this.tilePositionCache)
    this.targetTilePositionColumn = this.tilePositionCache[0] // this.tilePositionCache[0] - nonnegativeRemainder(this.tilePositionCache[0], 3)
    this.targetTilePositionRow = this.tilePositionCache[1] // (this.tilePositionCache[1] >> 1) * 2
    console.log(`Camera @ ${cameraTarget.x}, ${cameraTarget.z} -> tile ${this.targetTilePositionColumn}, ${this.targetTilePositionRow}`)
    if (nonnegativeRemainder(this.targetTilePositionColumn, 6) >= 3) {
      // Odd token column, so row is offset.
      this.targetTilePositionRow++
    }

    const lastLoadId = this.lastGridLoadId
    const currentGridLoadId = this.boardReq.getGameBoard().loadId
    this.lastGridLoadId = currentGridLoadId

    if (
        !force
        && prevTargetColumn === this.targetTilePositionColumn
        && prevTargetRow === this.targetTilePositionRow
        && lastLoadId === currentGridLoadId
    ) {
      // No change and not forced to update.
      // Don't do anything.
      return
    }

    if (lastLoadId !== currentGridLoadId) {
      // The game board updated its state, due to something loading.
      // Need to refresh the whole grid.
      this.updateGrid()
      return
    }

    // If a large ratio of tiles need to be updated, then recreate the
    // entire grid.
    const deltaCol = this.targetTilePositionColumn - prevTargetColumn
    if (Math.abs(deltaCol) > this.visibleWidth) {
      // All of the columns have moved off-screen, so redraw the whole thing.
      this.updateGrid()
      return
    }

    const deltaRow = this.targetTilePositionRow - prevTargetRow
    if (Math.abs(deltaRow) > this.visibleHeight) {
      // All of the rows have moved off-screen, so redraw the whole thing.
      this.updateGrid()
      return
    }

    console.log(`Updating grid (${prevTargetColumn},${prevTargetRow} -> ${this.targetTilePositionColumn},${this.targetTilePositionRow}) and load ID (${lastLoadId} -> ${currentGridLoadId})`)

    const tileRatio = Math.abs(deltaCol * deltaRow / (this.visibleWidth * this.visibleHeight))

    if (tileRatio >= UPDATE_GRID_RATIO) {
      // Too many things need to be updated to make the small adju7stments.
      // Update the entire grid
      this.updateGrid()
    } else {
      // This means it's an incremental adjustment.
      this.moveGridByTiles(deltaCol, deltaRow)
    }
  }


  // updateGrid update the entire grid around the center point
  // Reconstructs the data.
  private updateGrid() {
    console.log(`Updating entire grid`)
    this.segmentManager.startRedraw()

    // The grid lookup is added to, regardless of the segment
    // position.  We don't need to make it line up with segments,
    // because as incremental changes happen, it gets jumbled up
    // anyway.

    // Reset all tile positions
    this.tilePosGridTileIndex = {}
    this.tokenIdToSegmentTileIndex = {}

    // Vertex index
    let vertexIndex = 0

    // Grid tile index
    let gridTileIndex = 0

    // position and normal array index
    // let pnIdx = 0
    const positions = this.geometry.getAttribute('position') as THREE.BufferAttribute
    const normals = this.geometry.getAttribute('normal') as THREE.BufferAttribute

    // uv array index
    // let uvIdx = 0
    const uv = this.geometry.getAttribute('uv') as THREE.BufferAttribute

    // Loop across each segment.  This requires multiple passes on row/column.
    //   Care is taken to ensure the whole board is covered.
    //   The algorithm moves from segment to segment, column increment then
    //   row.  In each segment, the visible sub-set of tiles are looped over.
    //   The internal grid index simply stores each tile as it's generated;
    //   no attempt is made to match the grid index with the graphical
    //   triangle position.  Instead, the vertex index lookup table performs
    //   that mapping.
    // Some optimizations:
    //   Don't use the buffer array, but instead directly access the
    //   underlying array and mass copy at the very end.
    const seenSegments: {[key: string]: ClientGameBoardSegment} = {}

    const board = this.boardReq.getGameBoard()
    const segWidth = board.segmentWidth
    const segHeight = board.segmentHeight
    const leftCol = this.targetTilePositionColumn - (this.visibleWidth >> 1)
    const topRow = this.targetTilePositionRow - (this.visibleHeight >> 1)
    const rightCol = leftCol + this.visibleWidth
    const bottomRow = topRow + this.visibleHeight

    let startCol = leftCol
    let startRow = topRow

    while (startRow < bottomRow) {
      let segment = this.segmentManager.getSegment(startCol, startRow)
      seenSegments[segment.segmentId] = segment

      // Triangle positions are regularly placed, so can have pre-computation
      // as much as possible.
      const startX = startCol * SIDE_LENGTH_HALF
      let x = startX
      let z = startRow * BASE_LENGTH

      // The tile index in the segment can be incremented rather than re-calculated.
      // The starting point is relative to the starting col/row.
      let startRowTileIndex = (startCol - segment.x) + ((startRow - segment.y) * segWidth)

      // Draw to the end of the segment or the end of the visible grid, which ever is first.
      const endCol = Math.min(rightCol, segment.x + segWidth)
      const endRow = Math.min(bottomRow, segment.y + segHeight)
      for (let row = startRow; row < endRow; row++) {
        let tileColLookup = this.tilePosGridTileIndex[row]
        if (tileColLookup === undefined) {
          tileColLookup = {}
          this.tilePosGridTileIndex[row] = tileColLookup
        }
        let tileIdx = startRowTileIndex
        for (let col = startCol; col < endCol; col++) {
          const tile = segment.tiles[tileIdx]

          // Update pointers
// console.debug(`G${gridTileIndex}: world (${col}, ${row}), segment ${segment.segmentId} (${col - segment.x}, ${row - segment.y}) @ ${tileIdx}`)
          const gridTile = this.gridTiles[gridTileIndex]
          gridTile.x = col
          gridTile.y = row
          gridTile.segmentId = segment.segmentId
          gridTile.tileIndex = tileIdx
          if (tile.tokenId !== null) {
            let tokenLookup = this.tokenIdToSegmentTileIndex[tile.tokenId]
            if (tokenLookup === undefined) {
              tokenLookup = []
              this.tokenIdToSegmentTileIndex[tile.tokenId] = tokenLookup
            }
            tokenLookup.push(tileIdx)
          }

          tileColLookup[col] = gridTileIndex
          this.vertexIndexToGridTileIndex[vertexIndex    ] = gridTileIndex
          gridTile.vertexA = vertexIndex
          this.vertexIndexToGridTileIndex[vertexIndex + 1] = gridTileIndex
          gridTile.vertexB = vertexIndex + 1
          this.vertexIndexToGridTileIndex[vertexIndex + 2] = gridTileIndex
          gridTile.vertexC = vertexIndex + 2

          // Is this an even or odd triangle?
          //   Could store this per triangle, but it's a cheap calculation.
          //   Note that this doesn't need negative checks.
          const crOdd = (row + col) & 0x1

          // -------------------------------------
          // 2D (x-z) Location Calculation
          // Points A, B, C:
          //      + A
          //     / \
          //  B +---+ C
          // To flip the z coordinate, it's (z + (crOdd * BASE_LENGTH)) or (z + ((1 - crOdd) * BASE_LENGTH))
          const ax = x + SIDE_LENGTH_HALF
          const az = z + (crOdd * BASE_LENGTH)
          let bx = x
          let bz = z + ((1 - crOdd) * BASE_LENGTH)
          let cx = x + SIDE_LENGTH
          let cz = bz

          // Height positions were already computed for the correct
          //   odd/even flipped vertex.
          const ay = tile.vertexHeight[0] * HEIGHT_SCALE
          const by = tile.vertexHeight[1] * HEIGHT_SCALE
          const cy = tile.vertexHeight[2] * HEIGHT_SCALE

          if (crOdd !== 0) {
            // Need to swap the b & c to accomodate the right-hand rule
            // to make the normals all point in the right direction
            const tmpx = bx
            const tmpz = bz
            bx = cx
            bz = cz
            cx = tmpx
            cz = tmpz
          }

          // Height is just a place-holder for the moment.
          // It is fully calculated later, once the lookup pointers
          // are all in place.

          // -------------------------------
          // Update the mesh values

// console.debug(` ${crOdd}: (${ax}, ${az}), (${bx}, ${bz}), (${cx}, ${cz})`)
          // TODO it may be faster to avoid this hidden index lookup and instead
          //   do it ourselves, then perform an array copy at the end.
          //   That would mean the height (y) doesn't need to be messed with
          //   yet, too, which is one more extra thing that's happening right now.
          positions.setXYZ(vertexIndex    , ax, ay, az)
          positions.setXYZ(vertexIndex + 1, bx, by, bz)
          positions.setXYZ(vertexIndex + 2, cx, cy, cz)

          // flat face normals
          this.pA.set(ax, ay, az)
          this.pB.set(bx, by, bz)
          this.pC.set(cx, cy, cz)

          this.cb.subVectors(this.pC, this.pB)
          this.ab.subVectors(this.pA, this.pB)
          this.cb.cross(this.ab)

          this.cb.normalize()

          const nx = this.cb.x
          const ny = this.cb.y
          const nz = this.cb.z

          normals.setXYZ(vertexIndex    , nx, ny, nz)
          normals.setXYZ(vertexIndex + 1, nx, ny, nz)
          normals.setXYZ(vertexIndex + 2, nx, ny, nz)
          // uv (texture map) position requires turning the tile into the
          //   corresponding hexagon triangle index.
          const hexIndex = tile.tokenHexTileIndex
          gridTile.hexIndex = hexIndex
          gridTile.hexColumn = hexIndex % 3
          gridTile.hexRow = (hexIndex / 3) | 0

          let hover = false
          let selected = false
          if (tile.tokenId !== null) {
            const tokenMode = this.tokenIdModes[tile.tokenId]
            if (tokenMode !== undefined) {
              hover = tokenMode.hoverOver
              selected =tokenMode.selected
            }
          }

          // Need to check if this UV map lookup can be optimized.
          const uvPos = this.textureHandler.getTileUVMap(tile, hexIndex, hover, selected)
          uv.setXY(vertexIndex    , uvPos[0][0], uvPos[0][1])
          uv.setXY(vertexIndex + 1, uvPos[1][0], uvPos[1][1])
          uv.setXY(vertexIndex + 2, uvPos[2][0], uvPos[2][1])

          // -------------------------------------
          // End of loop number update
          // pnIdx += 3 * 3
          // uvIdx += 3 * 2
          vertexIndex += 3
          tileIdx++
          gridTileIndex++
          x += SIDE_LENGTH_HALF
        }

        // End of a row, so increment the start tile index by a row.
        startRowTileIndex += segWidth
        x = startX
        z += BASE_LENGTH
      }

      // End of a segment.

      // Advance the segment location.  This will move along the
      //   segment column first, and when that reaches the end, move
      //   down a row.
      // The first segment encountered will probably have the start column === left column,
      //   which isn't aligned with the segment start.  Instead, once the left-side
      //   segment is handled, it must increment by the segment chunks.
      startCol = segment.x + segWidth
      if (startCol > rightCol) {
        startCol = leftCol
        // The same chunk increment for the row applies.
        startRow = segment.y + segHeight
      }
    }

    positions.needsUpdate = true
    normals.needsUpdate = true
    uv.needsUpdate = true

    // Finish up the draw.
    this.segmentManager.completeDraw()
  }


  // moveGrid change some triangles to render a different part of the segments.
  private moveGridByTiles(deltaColumn: integer, deltaRow: integer) {
    console.log(`Moving grid ${deltaColumn}, ${deltaRow} tiles`)
    // FIXME COMPLETE
    //   1. perform a reverse mapping of populateTargetAtTile to find new target position
    //   2. pass this as a delta to the moveGridByTiles.
    // For now, just redraw the whole thing.
    this.updateGrid()
  }


  private loadGridTileTokens(gridTileIndex: integer, intersection: IntersectedTokenTile) {
    const grid = this.gridTiles[gridTileIndex]

    // Segments hold whole tokens.
    intersection.segmentId = grid.segmentId
    if (grid.segmentId === EMPTY_SEGMENT_ID) {
      intersection.tokenId = null
      return
    }
    const segment = this.segmentManager.getSegmentById(grid.segmentId)
    const baseTile = segment.tiles[grid.tileIndex]
    intersection.tokenId = baseTile.tokenId
    if (intersection.tokenId === null) {
      return
    }
    const tileIdxList = this.tokenIdToSegmentTileIndex[intersection.tokenId]
    if (tileIdxList === undefined) {
      // This can happen for loading segments.
      return
    }

    // TODO the "|| (something)" code here is due to a bad rendering
    //   Once the code is rendering right, this shouldn't be a problem... right?
    const hexCol0 = grid.x - grid.hexColumn
    const hexRow0 = grid.y - grid.hexRow

    intersection.gridIndex0 = this.tilePosGridTileIndex[hexRow0][hexCol0]
    intersection.tokenTile0 = segment.tiles[tileIdxList[0]] || null

    intersection.gridIndex1 = this.tilePosGridTileIndex[hexRow0][hexCol0 + 1]
    intersection.tokenTile1 = segment.tiles[tileIdxList[1]] || null

    intersection.gridIndex2 = this.tilePosGridTileIndex[hexRow0][hexCol0 + 2]
    intersection.tokenTile2 = segment.tiles[tileIdxList[2]] || null

    intersection.gridIndex3 = this.tilePosGridTileIndex[hexRow0 + 1][hexCol0]
    intersection.tokenTile3 = segment.tiles[tileIdxList[3]] || null

    intersection.gridIndex4 = this.tilePosGridTileIndex[hexRow0 + 1][hexCol0 + 1]
    intersection.tokenTile4 = segment.tiles[tileIdxList[4]] || null

    intersection.gridIndex5 = this.tilePosGridTileIndex[hexRow0 + 1][hexCol0 + 2]
    intersection.tokenTile5 = segment.tiles[tileIdxList[5]] || null
  }


  // getInersectedTile find the tile / token that the x/y is over.
  //   Casts a ray from the camera through the x/y (range -1 to 1) of the screen
  //   to find the first tile and its token id.  The structure is populated with
  //   the intersection.
  populateIntersectedTile(camera: THREE.Camera, clientX: number, clientY: number, intersection: IntersectedTokenTile) {
    if (this.object !== null) {
      this.coords.x = clientX
      this.coords.y = clientY
      // console.log(`Checking for intersection with screen at ${clientX}, ${clientY}`)
      this.raycaster.setFromCamera(this.coords, camera)
      const intersects = this.raycaster.intersectObject(this.object)
      if (intersects.length > 0) {
        const intersect = intersects[0]
        const face = intersect.face
        if (face) {
          // console.log(` - Intersected face ${face.a}, ${face.b}, ${face.c}`)
          const gridIndex = this.vertexIndexToGridTileIndex[face.a]
          if (gridIndex !== undefined) {
            // console.log(` - => ${gridIndex}`)
            this.loadGridTileTokens(gridIndex, intersection)
            return
          }
          // console.log(` - No grid set for face`)
        }
      }
    }
    intersection.segmentId = EMPTY_SEGMENT_ID
    intersection.tokenId = null
  }


  // updateTileTexture update the texture UV positions for the tile.
  updateTileTexture(intersection: IntersectedTokenTile, mode: TileMode) {
    if (intersection.tokenId === null) {
      return
    }

    // Update our lookup for redraw purposes.
    if (mode.hoverOver === false && mode.selected === false) {
      // Remove this from our list.
      if (this.tokenIdModes[intersection.tokenId] !== undefined) {
        delete this.tokenIdModes[intersection.tokenId]
      }
    } else {
      this.tokenIdModes[intersection.tokenId] = { ...mode }
    }

    const uv = this.geometry.getAttribute('uv') as THREE.BufferAttribute
    let uvMap: number[][]
    let gt: GridTileInfo

    // TODO Optimization here:
    // Because we know the vertex for a grid tile are allocated at the same time
    //   (grid tile index === vertex index / 3), we can change the tile uv map
    //   in memory to instead be the 6 points all in the same array.  That would be
    //   a simple array copy, rather than a series of lookups.

    if (intersection.tokenTile0 !== null) {
      uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile0, 0, mode.hoverOver, mode.selected)
      gt = this.gridTiles[intersection.gridIndex0]
      // FIXME how does gt get to be undefined when tokenTile0 !== null?!?
      if (gt !== undefined) {
        uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
        uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
        uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])
      }
    }

    if (intersection.tokenTile1 !== null) {
      uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile1, 1, mode.hoverOver, mode.selected)
      gt = this.gridTiles[intersection.gridIndex1]
      uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
      uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
      uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])
    }

    if (intersection.tokenTile2 !== null) {
      uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile2, 2, mode.hoverOver, mode.selected)
      gt = this.gridTiles[intersection.gridIndex2]
      uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
      uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
      uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])
    }

    if (intersection.tokenTile3 !== null) {
      uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile3, 3, mode.hoverOver, mode.selected)
      gt = this.gridTiles[intersection.gridIndex3]
      uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
      uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
      uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])
    }

    if (intersection.tokenTile4 !== null) {
      uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile4, 4, mode.hoverOver, mode.selected)
      gt = this.gridTiles[intersection.gridIndex4]
      uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
      uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
      uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])
    }

    if (intersection.tokenTile5 !== null) {
      uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile5, 5, mode.hoverOver, mode.selected)
      gt = this.gridTiles[intersection.gridIndex5]
      uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
      uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
      uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])
    }

    uv.needsUpdate = true
  }


  // onSegmentLoaded A whole game board segment completed loading from the server.
  private onGameBoardSegmentLoaded(_x: integer, _y: integer, segmentId: string): void {
    this.segmentManager.onSegmentUpdate(this.boardReq.getGameBoard().segments[segmentId])
    // Note: this doesn't cause the grid to immediately update.
    // Instead, on the next update loop, the last load vs. current load id will be
    // checked.  This prevents a rapid fire segment load from changing everything.
    // However, this could instead check if the segment is visible, and, if so,
    // just update that one segment.
  }

  // onSegmentUpdated One or more tile in a game board segment was updated from the server.
  private onGameBoardSegmentUpdated(_x: integer, _y: integer, segmentId: string, _tileIndicies: integer[]): void {
    this.segmentManager.onSegmentUpdate(this.boardReq.getGameBoard().segments[segmentId])
    // At the moment, this will cause the update() call to discover the load ID to be different
    //   than the last load ID, and trigger a refresh.
    //   This *should* mean just changing existing visible tiles, which should at most include
    //   their heights + uv position + the heights of the tiles in adjacent tokens.

  }

  // onSegmentRemoved the game board has chosen to remove this segment from memory.
  // Anything holding onto data related to this segment should be removed.
  // This will only be called if:
  //    * markSegmentNotVisible called for this segment.
  //    * no onSegmentLoaded or onSegmentUpdated called after markSegmentNotVisible and before this
  //      event call made.
  private onGameBoardSegmentRemoved(_x: integer, _y: integer, _segmentId: string): void {
    // ignore.
  }

}


const LOADING_TILES: ClientTile[] = [
  {
    category: CATEGORY_LOADING,
    tokenId: null,
    variation: 0,
    height: EMPTY_TILE_HEIGHT,
    parameters: {},
    tokenHexTileIndex: 0,
    vertexHeight: [0, 0, 0],
    vertexHeightSum: [0, 0, 0],
    vertexHeightCount: [0, 0, 0],
  },
  {
    category: CATEGORY_LOADING,
    tokenId: null,
    variation: 0,
    height: EMPTY_TILE_HEIGHT,
    parameters: {},
    tokenHexTileIndex: 1,
    vertexHeight: [0, 0, 0],
    vertexHeightSum: [0, 0, 0],
    vertexHeightCount: [0, 0, 0],
  },
  {
    category: CATEGORY_LOADING,
    tokenId: null,
    variation: 0,
    height: EMPTY_TILE_HEIGHT,
    parameters: {},
    tokenHexTileIndex: 2,
    vertexHeight: [0, 0, 0],
    vertexHeightSum: [0, 0, 0],
    vertexHeightCount: [0, 0, 0],
  },
  {
    category: CATEGORY_LOADING,
    tokenId: null,
    variation: 0,
    height: EMPTY_TILE_HEIGHT,
    parameters: {},
    tokenHexTileIndex: 3,
    vertexHeight: [0, 0, 0],
    vertexHeightSum: [0, 0, 0],
    vertexHeightCount: [0, 0, 0],
  },
  {
    category: CATEGORY_LOADING,
    tokenId: null,
    variation: 0,
    height: EMPTY_TILE_HEIGHT,
    parameters: {},
    tokenHexTileIndex: 4,
    vertexHeight: [0, 0, 0],
    vertexHeightSum: [0, 0, 0],
    vertexHeightCount: [0, 0, 0],
  },
  {
    category: CATEGORY_LOADING,
    tokenId: null,
    variation: 0,
    height: EMPTY_TILE_HEIGHT,
    parameters: {},
    tokenHexTileIndex: 5,
    vertexHeight: [0, 0, 0],
    vertexHeightSum: [0, 0, 0],
    vertexHeightCount: [0, 0, 0],
  },
]


class SegmentManager {
  private previousVisibleSegments: {[keys: string]: ClientGameBoardSegment}
  private currentVisibleSegments: {[keys: string]: ClientGameBoardSegment}
  private boardReq: GameBoardRequests
  private loadingTiles: ClientTile[]
  private normalizeArray: integer[]

  constructor(boardReq: GameBoardRequests) {
    this.boardReq = boardReq
    this.previousVisibleSegments = {}
    this.currentVisibleSegments = {}
    this.normalizeArray = [0, 0]

    const board = boardReq.getGameBoard()
    const segTileCount = board.segmentWidth * board.segmentHeight
    this.loadingTiles = new Array<ClientTile>(segTileCount)
    let row = 0
    let col = 0
    for (let i = 0; i < segTileCount; i++) {
      // no negative checks, because col/row are strictly non-negative.
      let tileHex = (col % 3)
      if ((col % 6) < 3) {
        tileHex += row % 2
      } else {
        tileHex = 1 - (row % 2)
      }
      // Note: not a copy, but a pointer.
      this.loadingTiles[i] = LOADING_TILES[tileHex]

      // End-of-loop adjustments
      col++
      if (col > board.segmentWidth) {
        col = 0
        row++
      }
    }
  }

  onSegmentUpdate(segment: ClientGameBoardSegment) {
    if (this.previousVisibleSegments[segment.segmentId] !== undefined) {
      this.previousVisibleSegments[segment.segmentId] = segment
    }
    if (this.currentVisibleSegments[segment.segmentId] !== undefined) {
      this.currentVisibleSegments[segment.segmentId] = segment
    }
  }

  // startRedraw Start drawing the whole grid.
  startRedraw() {
    this.previousVisibleSegments = this.currentVisibleSegments
    this.currentVisibleSegments = {}
  }

  // startIncrement Start an incremental adjustment to the grid.
  startIncrement() {
    this.previousVisibleSegments = {...this.currentVisibleSegments}
  }

  // completeDraw Mark the drawing as complete, and ready to manage the not visible segments
  completeDraw() {
    // At the end of this, the previous map is not used.

    // Make the previous list contain only things that aren't in the current list.
    Object.keys(this.currentVisibleSegments).forEach((segId) => {
      delete this.previousVisibleSegments[segId]
    })
    // Everything remaining in the previous visible segments are not being used.
    Object.keys(this.previousVisibleSegments).forEach((segId) => { this.boardReq.markSegmentNotVisible(segId) })
  }

  // getSegmentById Look up a segment by its identifier
  // The segmentId should have already been loaded and stored in one of the allocated
  // pointers.
  getSegmentById(segmentId: string): ClientGameBoardSegment {
    let seg = this.currentVisibleSegments[segmentId]
    if (seg !== undefined) {
      return seg
    }
    throw new Error(`Requested not-visible segment ${segmentId}`)
  }

  // getSegment Request a segment for drawing
  // This marks the segment as being visible.
  getSegment(col: integer, row: integer): ClientGameBoardSegment {
    const segId = this.boardReq.getSegmentId(col, row)
    let seg = this.previousVisibleSegments[segId]
    if (seg !== undefined) {
      this.currentVisibleSegments[segId] = seg
      return seg
    }
    seg = this.currentVisibleSegments[segId]
    if (seg !== undefined) {
      // already marked as visible
      return seg
    }
    // Not in any list.  Check if it's in the board.
    seg = this.boardReq.getGameBoard().segments[segId]
    if (seg !== undefined) {
      this.currentVisibleSegments[segId] = seg
      return seg
    }
    // Not loaded.
    this.boardReq.populateNormalizedSegmentPosition(col, row, this.normalizeArray)
    this.boardReq.requestSegment(this.normalizeArray[0], this.normalizeArray[1], segId)
    // Create a placeholder.
    seg = {
      x: this.normalizeArray[0],
      y: this.normalizeArray[1],
      segmentId: segId,

      // FIXME by just blanketing the loading tiles here, the
      //   hex position may be off, because it's not necessarily at offset 0
      //   for this load.
      tiles: this.loadingTiles,
    }
    this.currentVisibleSegments[segId] = seg
    return seg
  }

  // discardSegment Remove the segment from the visible set.
  discardSegment(col: integer, row: integer) {
    delete this.currentVisibleSegments[this.boardReq.getSegmentId(col, row)]
  }
}
