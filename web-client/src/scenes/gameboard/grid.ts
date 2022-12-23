// Manage the grid mesh.
import { THREE, ExtendedMesh, ExtendedObject3D } from 'enable3d'
import { TextureHandler } from './texture-handler'
import {
  GameBoardManager,
  ClientTile,
  GameBoardRequests,
  GameBoardStatusHandler,
  ClientGameBoardSegment,
} from '../../gameboard-state'


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
  tileId0: integer
  tileId1: integer
  tileId2: integer
  tileId3: integer
  tileId4: integer
  tileId5: integer
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
    tileId0: 0,
    tileId1: 0,
    tileId2: 0,
    tileId3: 0,
    tileId4: 0,
    tileId5: 0,
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

// Height (y) is then calculated based on the hexagon/triangle split.
// Each tile contains the height for its hexagon, which we mark as the center
// of the hexagon.  If we look at the points on the hexagon:
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

// And based on the point/triangle diagram above, this maps verticies as linked
// to other triangles (use H(0) as the current hex):
//    P0 -> H(0):T(0, 0), H(0):T(1, 1), H(A):T(2, 1), H(B):T(1, 1)
//    P1 -> H(0):T(1, 0), H(0):T(2, 0), H(B):T(1, 1), H(C):T(0, 1)
//    P2 -> H(0):T(0, 0), H(0):T(0, 1), H(A):T(2, 1), H(D):T(2, 0)
//    P3 -> [every triangle in H0]
//    P4 -> H(0):T(2, 0), H(0):T(2, 1), H(C):T(0, 1), H(F):T(0, 0)
//    P5 -> H(0):T(0, 1), H(0):T(1, 1), H(D):T(2, 0), H(E):T(1, 0)
//    P6 -> H(0):T(1, 1), H(0):T(2, 1), H(E):T(1, 0), H(F):T(0, 0)
// Note that there are other triangles in the other hexes that also match up with these
// points, but each point in each triangle of H(0) only needs to look up 1 triangle in
// another hexagon.

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
  private vertexIndexToGridTileIndex: Uint32Array

  // for the given token ID, get the grid tiles with that token ID.
  private tokenIdToSegmentTileIndex: {[key: integer]: integer[]}

  // Looks up a grid tile index by the tile's [row][col] coordinates
  //    Note how this lookup is backwards from the usual nomenclature of col/row.
  private tilePosGridTileIndex: {[keys: integer]: {[keys: integer]: integer}}


  constructor(
    boardManager: GameBoardManager,
    texture: THREE.Texture,
    textureHandler: TextureHandler,
    visibleWidth: integer,   // in tiles, not tokens
    visibleHeight: integer,  // in tiles, not tokens

    // initial tile the client looks at
    //   Note: the server tells the client where the player's starting
    //   position is based on tile position.
    targetTilePositionColumn: integer,
    targetTilePositionRow: integer,
  ) {
    // -----------------------------
    // Argument Value Adjustments
    // Need to ensure that height wise we always show at least 2
    // full tokens, for one above and one below.  This makes target adjustment
    // easier by moving a complete token along the z axis.
    visibleHeight = (visibleHeight >> 2) * 4
    // Width wise, we want to have it be at least 2 complete tokens
    // so that the segment loading and the token adjustment is easier.
    visibleWidth = (visibleWidth >> 2) * 4

    // Make sure the target points at the start of a token.
    targetTilePositionColumn = targetTilePositionColumn - (targetTilePositionColumn % 3)
    targetTilePositionRow = (targetTilePositionRow >> 1) * 2
    if (targetTilePositionColumn % 6 >= 3) {
      // Odd token column, so row is offset.
      targetTilePositionRow++
    }

    const triangleCount = visibleWidth * visibleHeight


    // -----------------------------
    // Property Initialization
    const self = this

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
    const material = new THREE.MeshBasicMaterial({
      map: texture,
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


  // updateTileTexture update the texture UV positions for the tile.
  updateTileTexture(intersection: IntersectedTokenTile, mode: TileMode) {
    if (intersection.tokenId === null) {
      return
    }

    const uv = this.geometry.getAttribute('uv') as THREE.BufferAttribute
    let uvMap: number[][]
    let gt: GridTileInfo

    uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile0 as ClientTile, 0, mode.hoverOver, mode.selected)
    gt = this.gridTiles[intersection.tileId0]
    uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
    uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
    uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])

    uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile1 as ClientTile, 1, mode.hoverOver, mode.selected)
    gt = this.gridTiles[intersection.tileId1]
    uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
    uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
    uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])

    uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile2 as ClientTile, 2, mode.hoverOver, mode.selected)
    gt = this.gridTiles[intersection.tileId2]
    uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
    uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
    uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])

    uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile3 as ClientTile, 3, mode.hoverOver, mode.selected)
    gt = this.gridTiles[intersection.tileId3]
    uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
    uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
    uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])

    uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile4 as ClientTile, 4, mode.hoverOver, mode.selected)
    gt = this.gridTiles[intersection.tileId4]
    uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
    uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
    uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])

    uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile5 as ClientTile, 5, mode.hoverOver, mode.selected)
    gt = this.gridTiles[intersection.tileId5]
    uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
    uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
    uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])
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
    tilePos[startIndex] = (target.x / SIDE_LENGTH) | 0
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
    this.targetTilePositionColumn = this.tilePositionCache[0] - (this.tilePositionCache[0] % 3)
    this.targetTilePositionRow = (this.tilePositionCache[1] >> 1) * 2
    if (this.targetTilePositionColumn % 6 >= 3) {
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
    const deltaCol = this.targetTilePositionColumn - this.targetTilePositionRow
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

    // TODO should this be stored as an instance variable, because we only
    //   need to calculate it once?
    const triangleCount = this.visibleWidth * this.visibleHeight

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
    // Care is taken to ensure the whole board is covered.
    // Full height calculation is done after generating the board.  The first
    // pass just sets the token height.
    // This is very inefficient.  For maximum efficiency, this should loop
    // over the border of the segment as up to 4 loops without height checks,
    // then within the border of the segment with height calculations.
    // Then, a final pass over the borders.  The borders positions within
    // the array buffers would need to be recorded for even faster processing.
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
// console.log(`Grid ${gridTileIndex}: world (${col}, ${row}), segment ${segment.segmentId} (${col - segment.x}, ${row - segment.y}) @ ${tileIdx}`)
          const gridTile = this.gridTiles[gridTileIndex]
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

          // TODO it may be faster to avoid this hidden index lookup and instead
          //   do it ourselves, then perform an array copy at the end.
          //   That would mean the height (y) doesn't need to be messed with
          //   yet, too, which is one more extra thing that's happening right now.
          positions.setXYZ(vertexIndex    , ax, 0, az)
          positions.setXYZ(vertexIndex + 1, bx, 0, bz)
          positions.setXYZ(vertexIndex + 2, cx, 0, cz)

          // uv (texture map) position requires turning the tile into the
          //   corresponding hexagon triangle index.
          let hexIndex: number
          let col3 = col % 3
          if (col3 < 0) {
            col3 += 3
          }
          let row2 = row % 2
          if (row2 < 0) {
            row2 += 2
          }
          let col6 = col % 6
          if (col6 < 0) {
            col6 += 6
          }
          if (col6 < 3) {
            hexIndex = col3 + (row2 * 3)
          } else {
            hexIndex = col3 + (((row2 + 1) & 0x1) * 3)
          }

          const uvPos = this.textureHandler.getTileUVMap(tile, hexIndex, false, false)
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

    // Update the heights and the normals
    const allGrids: (GridTileInfo | undefined)[] = [
      undefined, undefined, undefined, undefined, undefined, undefined,
    ]

    for (gridTileIndex = 0; gridTileIndex < triangleCount; gridTileIndex++) {
      // Find the current token and the adjacent 6 tokens
      const here = this.gridTiles[gridTileIndex]
      const segment = seenSegments[here.segmentId]
      const tile = segment.tiles[here.tileIndex]

      let agi = 0

      // The grid of:
      //  a a a b b b c c c
      //  a a a x x x c c c
      //  d d d x x x e e e
      //  d d d f f f e e e
      // Means that the adjacent 6 tokens to this one
      // can be for any hex value in the current token.  We perform
      // some math that will grab the adjacent tokens regardless of
      // the current token.

      // These computations find the corresponding triangle in the
      // adjacent 6 hexes.
      const rowAC = here.y - 1  // token a, c
      const rowACLookup = this.tilePosGridTileIndex[rowAC]

      const rowDE = rowAC + 2   // token d, e
      const rowDELookup = this.tilePosGridTileIndex[rowDE]

      const rowB = rowAC - 1    // token b
      const rowBLookup = this.tilePosGridTileIndex[rowB]

      const rowF = rowAC + 3    // token f
      const rowFLookup = this.tilePosGridTileIndex[rowF]

      const colAD = here.x - 3  // token a, d
      const colCE = colAD + 6    // token c, e
      const colBF = colAD + 3    // token b, f

      if (rowACLookup !== undefined) {
        // Token a
        allGrids[agi++] = this.gridTiles[rowACLookup[colAD]]
        // Token c
        allGrids[agi++] = this.gridTiles[rowACLookup[colCE]]
      }

      if (rowDELookup !== undefined) {
        // Token d
        allGrids[agi++] = this.gridTiles[rowDELookup[colAD]]
        // Token e
        allGrids[agi++] = this.gridTiles[rowDELookup[colCE]]
      }

      if (rowBLookup !== undefined) {
        // Token b
        allGrids[agi++] = this.gridTiles[rowBLookup[colBF]]
      }

      if (rowFLookup !== undefined) {
        // Token f
        allGrids[agi++] = this.gridTiles[rowFLookup[colBF]]
      }

      let height = tile.height
      let count = 1
      for (let i = 0; i < agi; i++) {
        const gt = allGrids[i]
        if (gt !== undefined) {
          height += seenSegments[gt.segmentId].tiles[gt.tileIndex].height
          count++
        }
      }

      height = (height * HEIGHT_SCALE) / count
      positions.setY(here.vertexA, height)
      positions.setY(here.vertexB, height)
      positions.setY(here.vertexC, height)

      // flat face normals
      this.pA.set(positions.getX(here.vertexA), height, positions.getZ(here.vertexA))
      this.pB.set(positions.getX(here.vertexB), height, positions.getZ(here.vertexB))
      this.pC.set(positions.getX(here.vertexA), height, positions.getZ(here.vertexC))

      this.cb.subVectors(this.pC, this.pB)
      this.ab.subVectors(this.pA, this.pB)
      this.cb.cross(this.ab)

      this.cb.normalize()

      const nx = this.cb.x
      const ny = this.cb.y
      const nz = this.cb.z

      normals.setXYZ(here.vertexA, nx, ny, nz)
      normals.setXYZ(here.vertexB, nx, ny, nz)
      normals.setXYZ(here.vertexC, nx, ny, nz)
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
    intersection.tileId0 = tileIdxList[0]
    intersection.tokenTile0 = segment.tiles[intersection.tileId0]

    intersection.tileId1 = tileIdxList[1]
    intersection.tokenTile1 = segment.tiles[intersection.tileId1]

    intersection.tileId2 = tileIdxList[2]
    intersection.tokenTile2 = segment.tiles[intersection.tileId2]

    intersection.tileId3 = tileIdxList[3]
    intersection.tokenTile3 = segment.tiles[intersection.tileId3]

    intersection.tileId4 = tileIdxList[4]
    intersection.tokenTile4 = segment.tiles[intersection.tileId4]

    intersection.tileId5 = tileIdxList[5]
    intersection.tokenTile5 = segment.tiles[intersection.tileId5]
  }


  // getInersectedTile find the tile / token that the x/y is over.
  //   Casts a ray from the camera through the x/y (range -1 to 1) of the screen
  //   to find the first tile and its token id.  The structure is populated with
  //   the intersection.
  populateIntersectedTile(camera: THREE.Camera, clientX: number, clientY: number, intersection: IntersectedTokenTile) {
    if (this.object !== null) {
      this.coords.x = clientX
      this.coords.y = clientY
      this.raycaster.setFromCamera(this.coords, camera)
      const intersects = this.raycaster.intersectObject(this.object)
      if (intersects.length > 0) {
        const intersect = intersects[0]
        const face = intersect.face
        if (face) {
          const gridIndex = this.vertexIndexToGridTileIndex[face.a]
          if (gridIndex !== undefined) {
            this.loadGridTileTokens(gridIndex, intersection)
            return
          }
        }
      }
    }
    intersection.segmentId = EMPTY_SEGMENT_ID
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


const LOADING_TILE: ClientTile = {
  category: "loading",
  tokenId: null,
  variation: 0,
  height: EMPTY_TILE_HEIGHT,
  parameters: {},
  hasAdjacentPlacedTile: false,
  isPlayerPlaceableToken: false,
}


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
    for (let i = 0; i < segTileCount; i++) {
      // Note: not a copy, but a pointer.
      this.loadingTiles[i] = LOADING_TILE
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
    Object.keys(this.previousVisibleSegments).forEach(this.boardReq.markSegmentNotVisible)
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
