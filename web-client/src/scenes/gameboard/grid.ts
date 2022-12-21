// Manage the grid mesh.
import { THREE, ExtendedMesh, ExtendedObject3D } from 'enable3d'
import { TextureHandler } from './texture-handler'
import {
  GameBoardManager,
  ClientTile,
  GameBoardRequests,
  GameBoardStatusHandler,
  ClientGameBoardSegment,
  sortGameBoardSegmentList,
} from '../../gameboard-state'


export interface Table3D {
  readonly objects: {[keys: string]: ExtendedObject3D}
}


export const EMPTY_SEGMENT_ID = ""


// IntersectedTokenTile data holder to identify a ray cast to the game board interseting a token
// Outside this file, users should consider this object to be obsure except for
// the `segmentId` value, which will equal EMPTY_SEGMENT_ID if no token was intersected.
export interface IntersectedTokenTile {
  // These are pointers to the tile itself.
  tokenTile0: ClientTile | null
  tokenTile1: ClientTile | null
  tokenTile2: ClientTile | null
  tokenTile3: ClientTile | null
  tokenTile4: ClientTile | null
  tokenTile5: ClientTile | null
  tileId0: number
  tileId1: number
  tileId2: number
  tileId3: number
  tileId4: number
  tileId5: number
  segmentId: string // === EMPTY_SEGMENT_ID for not intersected.
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
  segmentId: string
  x: integer  // absolute, in tiles
  y: integer  // absolute, in tiles
  tileIndex: integer
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

const SIDE_LENGTH = 1
const SIDE_LENGTH_HALF = SIDE_LENGTH / 2
const BASE_LENGTH = SIDE_LENGTH_HALF * Math.sqrt(3)
const HEIGHT_SCALE = 0.2
const EMPTY_TILE_HEIGHT = -5



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
  private texture: THREE.Texture
  private textureHandler: TextureHandler
  private board: GameBoardRequests
  private boardManager: GameBoardManager
  private boardHandler: GameBoardStatusHandler

  private visibleWidth: integer
  private visibleHeight: integer


  // Singleton data objects, reused during the calls.
  // Keeping them allocated saves time by not needing to recreate them or free them.
  private raycaster: THREE.Raycaster
  private coords: { x: number, y: number }

  // The grid stores 1 THREE object, which contains 0 or more segments.
  private object: ExtendedObject3D | null
  private geometry: THREE.BufferGeometry
  private boundingBox: THREE.Box3
  private pA: THREE.Vector3
	private pB: THREE.Vector3
	private pC: THREE.Vector3
  private cb: THREE.Vector3
  private ab: THREE.Vector3

  // Where the camera is looking at, based on a tile position.
  private targetTilePositionColumn: integer
  private targetTilePositionRow: integer


  // The code needs to be able to translate from a tile in a segment to vertex information,
  //   and back the other way.
  private gridTiles: GridTileInfo[]
  private vertexIndexToGridTileIndex: Uint32Array


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
      // Odd column, so row is offset.
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
    this.board = boardManager.registerHandler(this.boardHandler)

    this.targetTilePositionColumn = targetTilePositionColumn
    this.targetTilePositionRow = targetTilePositionRow

    this.texture = texture
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

    // Construct the basic grid information.
    this.gridTiles = new Array<GridTileInfo>(triangleCount)
    this.vertexIndexToGridTileIndex = new Uint32Array(3 * triangleCount)

    // ----------------------------------------
    // Basic planar position (x/z values)
    const normals = new Float32Array(3 * 3 * triangleCount)
    const uv = new Float32Array(2 * 3 * triangleCount)
    const positions = new Float32Array(3 * 3 * triangleCount)

    //   The starting x/z is based on maintaining the target view in the
    //   center of the grid.
    let column = targetTilePositionColumn - (visibleWidth >> 1)
    let row = targetTilePositionRow - (visibleHeight >> 1)
    //   The triangles along the columns in a single row overlap each other, so
    //   that 2 triangles create 1 full side length from start of one to
    //   start of next.
    let x = column * SIDE_LENGTH_HALF
    //   But the row distance extends along the base.
    let z = row * BASE_LENGTH
    let tileIndex = 0
    let vertex = 0
    let vIdx = 0
    let uvIdx = 0
    while (tileIndex < triangleCount) {
      const crOdd = (column + row) & 0x1

      this.gridTiles[tileIndex] = {
        segmentId: EMPTY_SEGMENT_ID,
        x: column,
        y: row,
        tileIndex,
        vertexA: vertex,
        vertexB: vertex + 1,
        vertexC: vertex + 2,
      }
      this.vertexIndexToGridTileIndex[vertex    ] = tileIndex
      this.vertexIndexToGridTileIndex[vertex + 1] = tileIndex
      this.vertexIndexToGridTileIndex[vertex + 2] = tileIndex

      // -------------------------------------
      // 2D (x-z) Location Calculation
      // Points A, B, C:
      //      + A
      //     / \
      //  B +---+ C
      // To flip the z coordinate, it's (z + (crOdd * BASE_LENGTH)) or (z + ((1 - hyOdd) * BASE_LENGTH))
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

      // -------------------------------
      // Update the mesh values
      // Height (y) will be computed separately.

      positions[vIdx    ] = ax
      positions[vIdx + 1] = 0
      positions[vIdx + 2] = az

      positions[vIdx + 3] = bx
      positions[vIdx + 4] = 0
      positions[vIdx + 5] = bz

      positions[vIdx + 6] = cx
      positions[vIdx + 7] = 0
      positions[vIdx + 8] = cz

      // Because height is computed separately,
      // the normals can't be computed yet.

      normals[vIdx    ] = 0
      normals[vIdx + 1] = 0
      normals[vIdx + 2] = 0

      normals[vIdx + 3] = 0
      normals[vIdx + 4] = 0
      normals[vIdx + 5] = 0

      normals[vIdx + 6] = 0
      normals[vIdx + 7] = 0
      normals[vIdx + 8] = 0

      // And the uv needs a tile to know where to
      // point the texture.

      uv[uvIdx    ] = 0
      uv[uvIdx + 1] = 0

      uv[uvIdx + 2] = 0
      uv[uvIdx + 3] = 0

      uv[uvIdx + 4] = 0
      uv[uvIdx + 5] = 0

      // ------------------------------
      // End-of-loop increment.
      vertex += 3
      vIdx += 3 * 3
      uvIdx += 2 * 3
      tileIndex++
      column++
      if (column >= visibleWidth) {
        column = 0
        row++
      }
    }

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
    this.geometry.computeBoundingBox()
    const box = this.geometry.boundingBox
    if (box === null) {
      throw new Error('bounding box not created')
    }
    this.boundingBox = box

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


  // updateTileTexture update the texture UV positions for the tile.
  updateTileTexture(intersection: IntersectedTokenTile, mode: TileMode) {
    if (
        intersection.tokenTile0 === null
        || intersection.tokenTile1 === null
        || intersection.tokenTile2 === null
        || intersection.tokenTile3 === null
        || intersection.tokenTile4 === null
        || intersection.tokenTile5 === null) {
      return
    }

    const uv = this.geometry.getAttribute('uv') as THREE.BufferAttribute
    let uvMap: number[][]
    let gt: GridTileInfo

    uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile0, 0, mode.hoverOver, mode.selected)
    gt = this.gridTiles[intersection.tileId0]
    uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
    uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
    uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])

    uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile1, 1, mode.hoverOver, mode.selected)
    gt = this.gridTiles[intersection.tileId1]
    uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
    uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
    uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])

    uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile2, 2, mode.hoverOver, mode.selected)
    gt = this.gridTiles[intersection.tileId2]
    uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
    uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
    uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])

    uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile3, 3, mode.hoverOver, mode.selected)
    gt = this.gridTiles[intersection.tileId3]
    uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
    uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
    uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])

    uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile4, 4, mode.hoverOver, mode.selected)
    gt = this.gridTiles[intersection.tileId4]
    uv.setXY(gt.vertexA, uvMap[0][0], uvMap[0][1])
    uv.setXY(gt.vertexB, uvMap[1][0], uvMap[1][1])
    uv.setXY(gt.vertexC, uvMap[2][0], uvMap[2][1])

    uvMap = this.textureHandler.getTileUVMap(intersection.tokenTile5, 5, mode.hoverOver, mode.selected)
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


  // updateTarget the target moved, so the grid might need an update.
  updateGridAtTarget(cameraTarget: THREE.Vector3) {
    if (this.object === null) {
      return
    }
    if (this.boundingBox.containsPoint(cameraTarget)) {
      // This means it's an incremental adjustment.
      // FIXME COMPLETE
      //   1. perform a reverse mapping of populateTargetAtTile to find new target position
      //   2. pass this as a delta to the moveGridByTiles.

      // TODO this should probably be, if < 1/2 of all tiles needs update, then
      //   perform the incremental update.  That means the bounding box isn't necessary to
      //   check for containsPoint, and thus means we don't need to maintain it in this
      //   class.
    } else {
      // Update the entire grid
      this.updateGrid(cameraTarget)
    }
  }


  // updateGrid update the entire grid around the center point
  // Reconstructs the data.  As for the target, only the x/z
  // position matters.
  private updateGrid(cameraTarget: THREE.Vector3) {

  }


  // moveGrid change some triangles to render a different part of the segments.
  private moveGridByTiles(deltaColumn: integer, deltaRow: integer) {

  }


  // getInersectedTile find the tile / token that the x/y is over.
  //   Casts a ray from the camera through the x/y (range -1 to 1) of the screen
  //   to find the first tile and its token id.  The structure is populated with
  //   the intersection.
  getIntersectedTile(camera: THREE.Camera, clientX: number, clientY: number, intersection: IntersectedTokenTile) {
    if (this.object !== null) {
      this.coords.x = clientX
      this.coords.y = clientY
      this.raycaster.setFromCamera(this.coords, camera)
      const intersects = this.raycaster.intersectObject(this.object)
      if (intersects.length > 0) {
        const intersect = intersects[0]
        const face = intersect.face
        if (face) {
          const tokenId = this.vertexToTokenId[face.a]
          if (tokenId === undefined) {
            intersection.tokenId = null
            return
          }
          // console.debug(`(${x}, ${y}) intersected face ${face.a} -> token ${tokenId}`)
          intersection.tokenId = tokenId
          intersection.segmentKey = this.segmentKey

          return {
            object: intersect.object as ExtendedObject3D,
            tokenId,
            tileIds: this.tokenTileMap[tokenId],
            segmentKey: userData.segmentKey,
          }
        }
      }
    }
    intersection.tokenId = null
  }


  // onSegmentLoaded A whole game board segment completed loading from the server.
  private onGameBoardSegmentLoaded(x: integer, y: integer, segmentId: string): void {

  }

  // onSegmentUpdated One or more tile in a game board segment was updated from the server.
  private onGameBoardSegmentUpdated(x: integer, y: integer, segmentId: string, tileIndicies: integer[]): void {

  }

  // onSegmentRemoved the game board has chosen to remove this segment from memory.
  // Anything holding onto data related to this segment should be removed.
  // This will only be called if:
  //    * markSegmentNotVisible called for this segment.
  //    * no onSegmentLoaded or onSegmentUpdated called after markSegmentNotVisible and before this
  //      event call made.
  private onGameBoardSegmentRemoved(x: integer, y: integer, segmentId: string): void {

  }

}


// createTableGrid construct a 3d model of the game board
//   Each segment is made into its own object.
export function createTableGrid(
  gameBoard: GameBoardState,
  meshTexture: THREE.Texture,
  textureHandler: TextureHandler,
): Table3D {

  // Order the game boards into row / column, so that
  const rowColumns = sortGameBoardSegments(gameBoard.segments)
  const emptySegmentTiles = cloneTileToBoardSegment(EMPTY_TILE, gameBoard.segmentSize)

  const objects: {[keys: string]: ExtendedObject3D} = {}
  for (let rowIndex = 0; rowIndex < rowColumns.length; rowIndex++) {
    const columns = rowColumns[rowIndex]
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
      // Construct the 3x3 grid to pass to the segment constructor.
      const segments: GameBoardSegment[] = []
      for (let rowDelta = -1; rowDelta <= 1; rowDelta++) {
        for (let columnDelta = -1; columnDelta <= 1; columnDelta++) {
          const row = rowIndex + rowDelta
          const col = columnIndex + columnDelta
          if (row < 0 || col < 0 || row >= rowColumns.length || col >= rowColumns[row].length) {
            segments.push({
              tiles: emptySegmentTiles,
              // position doesn't matter for the empty table.
              position: {x: col, y: row},
            })
          } else {
            segments.push(rowColumns[row][col])
          }
        }
      }
      const key = getGameBoardSegmentKey(segments[CENTER_SEGMENT_INDEX])
      objects[key] = createSegmentGrid(
        segments,
        gameBoard.segmentSize,
        gameBoard.size,
        meshTexture,
        textureHandler,
      )
    }
  }
  return {
    objects,
  }
}


function cloneTileToBoardSegment(
  tileTemplate: Tile, size: BoardSize,
): Tile[] {
  const count = size.width * size.height
  const tiles: Tile[] = []
  for (let i = 0; i < count; i++) {
    tiles.push({ ...tileTemplate })
  }
  return tiles
}


// TODO look at adding an index, as each point is
// shared with up to 6 triangles.


// For each triangle in the hexagon, the height on each point
// is the average of the height of adjacent triangles.  This
// finds those adjacent triangle coordinates in the segment.
// Each one of these triangle lookups is for the vertex A, B, C
// It's supposed to average 3 tile heights together, but only 2
// are given; because 1 is the current tile's height.
// Additionally, these are mapping from *tile* coordinates into
// the *height map* coordinates.

const HEX_TRI_HEIGHT_AVG_LOOKUP: number[][][][] = [
  // Because this includes seg coordinate to height map coordinate
  //   translation, they are an additional 1 to each value.
  // Each one of these ends with [1, 1] to refer to the current tile.

  // relative to triangle T(0, 0)
  [
    [[0, 1], [2, 0], [1, 1]],  // P0 -> H(A):T(2, 1), H(B):T(1, 1)
    [[0, 1], [0, 2], [1, 1]],  // P2 -> H(A):T(2, 1), H(D):T(2, 0)
    [[1, 1], [1, 1], [1, 1]],  // P3 - use the current triangle
  ],

  // relative to triangle T(1, 0)
  [
    [[ 1, 1], [1, 1], [1, 1]],  // P3 - use the current triangle
    [[ 1, 0], [3, 1], [1, 1]],  // P1 -> H(B):T(1, 1), H(C):T(0, 1)
    [[-1, 1], [1, 0], [1, 1]],  // P0 -> H(A):T(2, 1), H(B):T(1, 1)
  ],

  // relative to triangle T(2, 0)
  [
    [[0, 0], [2, 1], [1, 1]], // P1 -> H(B):T(1, 1), H(C):T(0, 1)
    [[1, 1], [1, 1], [1, 1]],  // P3 - use the current triangle
    [[2, 1], [2, 2], [1, 1]],  // P4 -> H(C):T(0, 1), H(F):T(0, 0)
  ],

  // relative to triangle T(0, 1)
  [
    [[0, 1], [2, 2], [1, 1]],  // P5 -> H(D):T(2, 0), H(E):T(1, 0)
    [[1, 1], [1, 1], [1, 1]],  // P3 - use the current triangle
    [[0, 0], [0, 1], [1, 1]],  // P2 -> H(A):T(2, 1), H(D):T(2, 0)
  ],

  // relative to triangle T(1, 1)
  [
    [[ 1, 1], [1, 1], [1, 1]],  // P3 - use the current triangle
    [[-1, 1], [1, 2], [1, 1]],  // P5 -> H(D):T(2, 0), H(E):T(1, 0)
    [[ 1, 2], [3, 1], [1, 1]],  // P6 -> H(E):T(1, 0), H(F):T(0, 0)
  ],

  // relative to triangle T(2, 1)
  [
    [[0, 2], [2, 1], [1, 1]],  // P6 -> H(E):T(1, 0), H(F):T(0, 0)
    [[2, 0], [2, 1], [1, 1]],  // P4 -> H(C):T(0, 1), H(F):T(0, 0)
    [[1, 1], [1, 1], [1, 1]],  // P3 - use the current triangle
  ],
]


// in a 3x3 grid, index 4 is the center.
const CENTER_SEGMENT_INDEX = 4
const UL_SEGMENT_INDEX = 0
const U_SEGMENT_INDEX = 1
const UR_SEGMENT_INDEX = 2
const L_SEGMENT_INDEX = 3
const R_SEGMENT_INDEX = 5
const BL_SEGMENT_INDEX = 6
const B_SEGMENT_INDEX = 7
const BR_SEGMENT_INDEX = 8


// createGrid create the triangle mesh for the game board.
//   segments: a 3x3 collection of segments with the center tile
//      being the one to render.
//      +---+---+---+
//      | 0 | 1 | 2 |
//      +---+---+---+
//      | 3 |*4*| 5 |
//      +---+---+---+
//      | 6 | 7 | 8 |
//      +---+---+---+
export function createSegmentGrid(
  segments: GameBoardSegment[],
  segmentSize: BoardSize,
  boardDim: BoardRect,
  meshTexture: THREE.Texture,
  textureHandler: TextureHandler,
): ExtendedObject3D {
  const triangleCount = segmentSize.width * segmentSize.height

  const vertexToTokenId: {[key: number]: number} = {}
  const tileIndexToVertexIndex: {[key: number]: number[]} = {}

  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(triangleCount * 3 * 3)
	const normals = new Float32Array(triangleCount * 3 * 3)
	const uvMap = new Float32Array(triangleCount * 3 * 2)

  const pA = new THREE.Vector3()
	const pB = new THREE.Vector3()
	const pC = new THREE.Vector3()

	const cb = new THREE.Vector3()
	const ab = new THREE.Vector3()

  const primary = segments[CENTER_SEGMENT_INDEX]

  // Because this height search can span across segments, we create a super-set of tile heights,
  // which has a bounary row/column.  This eliminates a large number of if statements per loop.
  // Mapping from tile position to height map position is mapRow = tileRow + 1, mapCol = tileCol + 1
  const heightMap = createHeightMap(segments, segmentSize)
  const heightMapWidth = segmentSize.width + 2

  // We count horizontally by column to discover the even/odd
  //   position, but the "y" value is directly maintained.
  const startX = (primary.position.x * SIDE_LENGTH_HALF) + ((boardDim.maxX + boardDim.minX) / 2)
  let column = 0
  let row = 0
  // x & z are the upper-left corner of the "square" containing the triangle.
  let x = startX
  let z = (primary.position.y * BASE_LENGTH) + ((boardDim.maxY + boardDim.minY) / 2)
  let vIdx = 0
  let uvIdx = 0
  for (let tileI = 0; tileI < primary.tiles.length; tileI++) {
    // Don't add the empty tiles.  But don't continue right
    //   away, because we need to run the loop variable increase
    //   at the end of this block.
    if (primary.tiles[tileI].category !== null) {
      const crOdd = (column + row) & 0x1

      // -------------------------------------
      // 2D (x-z) Location Calculation
      // Points A, B, C:
      //      + A
      //     / \
      //  B +---+ C
      // To flip the z coordinate, it's (z + (hyOdd * BASE_LENGTH)) or (z + ((1 - hyOdd) * BASE_LENGTH))
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

      // -------------------------------------
      // Height Calculation
      // Find the right height for each vertex.  This is
      // the average of 3 tiles (1 of which is the current tile).
      // This requires us to first perform a reverse tile index to hexagon triangle
      // discovery.
      let hexIndex: number
      if (column % 6 < 3) {
        hexIndex = (column % 3) + ((row % 2) * 3)
      } else {
        hexIndex = (column % 3) + (((row + 1) % 2) * 3)
      }

      const all_y = [EMPTY_TILE_HEIGHT, EMPTY_TILE_HEIGHT, EMPTY_TILE_HEIGHT]
      for (let vertexI = 0; vertexI < 3; vertexI++) {
        const tileLookupPoints = HEX_TRI_HEIGHT_AVG_LOOKUP[hexIndex][vertexI]
        let count = 0
        let total = 0
        for (let adjI = 0; adjI < 3; adjI++) {
          const adjTilePos = tileLookupPoints[adjI]
          // The adjustment position performs both a relative position
          //   lookup to the adjustment tile, and a translation from
          //   the current position to the height map position.
          const adjTile = heightMap[
            (column + adjTilePos[0])
            + ((row + adjTilePos[1]) * heightMapWidth)
          ]
          if (adjTile.category !== null) {
            count++
            total += adjTile.height
          }
        }
        if (count > 0) {
          all_y[vertexI] = total / count
        }
      }

      const ay = all_y[0] * HEIGHT_SCALE
      const by = all_y[1] * HEIGHT_SCALE
      const cy = all_y[2] * HEIGHT_SCALE

      // -------------------------------
      // Update the mesh values

      positions[vIdx    ] = ax
      positions[vIdx + 1] = ay
      positions[vIdx + 2] = az

      positions[vIdx + 3] = bx
      positions[vIdx + 4] = by
      positions[vIdx + 5] = bz

      positions[vIdx + 6] = cx
      positions[vIdx + 7] = cy
      positions[vIdx + 8] = cz

      // flat face normals

      pA.set(ax, ay, az)
      pB.set(bx, by, bz)
      pC.set(cx, cy, cz)

      cb.subVectors(pC, pB)
      ab.subVectors(pA, pB)
      cb.cross(ab)

      cb.normalize()

      const nx = cb.x
      const ny = cb.y
      const nz = cb.z

      normals[vIdx    ] = nx
      normals[vIdx + 1] = ny
      normals[vIdx + 2] = nz

      normals[vIdx + 3] = nx
      normals[vIdx + 4] = ny
      normals[vIdx + 5] = nz

      normals[vIdx + 6] = nx
      normals[vIdx + 7] = ny
      normals[vIdx + 8] = nz

      // colors (in range 0-1)
      const uvPos = textureHandler.getTileUVMap(primary.tiles[tileI], hexIndex, false, false)
      uvMap[uvIdx    ] = uvPos[0][0]
      uvMap[uvIdx + 1] = uvPos[0][1]
      uvMap[uvIdx + 2] = uvPos[1][0]
      uvMap[uvIdx + 3] = uvPos[1][1]
      uvMap[uvIdx + 4] = uvPos[2][0]
      uvMap[uvIdx + 5] = uvPos[2][1]

      // -------------------------------------
      // Hex Token Lookup Calculation

      const tokenId = primary.tiles[tileI].tokenId
      if (tokenId !== null) {
        // Convert the vertex x/y/z index into a vertex number.
        // This is what the geometry face vertex index references.
        const vertexIndex = (vIdx / 3) | 0

        for (let i = 0; i < 3; i++) {
          vertexToTokenId[vertexIndex + i] = tokenId
        }
        tileIndexToVertexIndex[tileI] = [vertexIndex, vertexIndex + 1, vertexIndex + 2]
      } else {
        console.log(`No tokenId for ${tileI} <- vertex ${vIdx}`)
      }

      // -------------------------------------
      // End of loop number update
      vIdx += 3 * 3
      uvIdx += 3 * 2
    }

    column++
    x += SIDE_LENGTH_HALF
    if (column >= segmentSize.width) {
      row++
      column = 0
      z += BASE_LENGTH
      x = startX
    }
  }

  // Doesn't seem like the array needs to be trimmed to the vIdx size.
  // However, there may be subtle issues we need to deal with if that's not the case.

  geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, vIdx), 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals.slice(0, vIdx), 3))
  const uvAttrib = new THREE.Float32BufferAttribute(uvMap.slice(0, uvIdx), 2)
  uvAttrib.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('uv', uvAttrib)

  geometry.computeBoundingSphere()

  // MeshPhysicalMaterial
  // MeshStandardMaterial - slowest/highest quality
  // MeshPhongMaterial
  // MeshLambertMaterial
  // MeshBasicMaterial - fastest/lowest quality
  const material = new THREE.MeshBasicMaterial({
    map: meshTexture,
    // specular: 0xaaaaaa,
    // shininess: 250,
    // metalness: 0.5,
    blending: 1,
    side: THREE.DoubleSide,
  })

  const mesh = new ExtendedMesh(geometry, material)
  const object = new ExtendedObject3D()
  object.add(mesh)

  object.userData = {
    vertexToTokenId,
    tileIndexToVertexIndex,
    segmentKey: getGameBoardSegmentKey(segments[CENTER_SEGMENT_INDEX]),
  } as GridBoardUserData
  return object
}


// createHeightMap map the heights in the current segment + a 1 tile buffer around it.
function createHeightMap(
  segments: GameBoardSegment[],
  segmentSize: BoardSize,
): Tile[] {
  // There are 2 coordinate systems we have to navigate between: the height map and the segment.
  const segmentWidth = segmentSize.width
  const segmentHeight = segmentSize.height
  const segmentFirstRowFirstColumnIndex = 0
  const segmentFirstRowLastColumnIndex = segmentWidth - 1
  const segmentLastRowFirstColumnIndex = (segmentHeight - 1) * segmentWidth
  const segmentLastRowLastColumnIndex = (segmentWidth * segmentHeight) - 1

  const mapWidth = segmentSize.width + 2
  const mapHeight = segmentSize.height + 2
  const mapFirstRowFirstColumnIndex = 0
  const mapFirstRowLastColumnIndex = mapWidth - 1
  const mapLastRowFirstColumnIndex = (mapHeight - 1) * mapWidth
  const mapLastRowLastColumnIndex = (mapWidth * mapHeight) - 1

  const ret = new Array<Tile>(mapWidth * mapHeight)

  // Fill in the 4 corners
  ret[mapFirstRowFirstColumnIndex] = segments[UL_SEGMENT_INDEX].tiles[segmentLastRowLastColumnIndex]
  ret[mapFirstRowLastColumnIndex] = segments[UR_SEGMENT_INDEX].tiles[segmentLastRowFirstColumnIndex]
  ret[mapLastRowFirstColumnIndex] = segments[BL_SEGMENT_INDEX].tiles[segmentFirstRowLastColumnIndex]
  ret[mapLastRowLastColumnIndex] = segments[BR_SEGMENT_INDEX].tiles[segmentFirstRowFirstColumnIndex]

  // Fill in the top & bottom sides
  for (let segIndex = 0; segIndex < segmentWidth; segIndex++) {
    // Top - from the top segment, bottom row
    let mapIndex = segIndex + 1 + mapFirstRowFirstColumnIndex
    ret[mapIndex] = segments[U_SEGMENT_INDEX].tiles[segmentLastRowFirstColumnIndex + segIndex]

    // Bottom - from the bottom segment
    mapIndex = segIndex + 1 + mapLastRowFirstColumnIndex
    ret[mapIndex] = segments[B_SEGMENT_INDEX].tiles[segmentFirstRowFirstColumnIndex + segIndex]
  }

  // Fill in the left & right sides
  for (let segRow = 0; segRow < segmentHeight; segRow++) {
    // Left side
    let segIndex = segmentFirstRowLastColumnIndex + (segRow * segmentWidth)
    let mapIndex = mapFirstRowFirstColumnIndex + ((segRow + 1) * mapWidth)
    ret[mapIndex] = segments[L_SEGMENT_INDEX].tiles[segIndex]

    // Right side
    segIndex = segmentFirstRowFirstColumnIndex + (segRow * segmentWidth)
    mapIndex = mapFirstRowLastColumnIndex + ((segRow + 1) * mapWidth)
    ret[mapIndex] = segments[R_SEGMENT_INDEX].tiles[segIndex]
  }

  // Fill in the center
  for (let segRow = 0; segRow < segmentHeight; segRow++) {
    const mapRow = segRow + 1
    for (let segCol = 0; segCol < segmentWidth; segCol++) {
      const mapCol = segCol + 1

      const segIndex = segCol + (segRow * segmentWidth)
      const mapIndex = mapCol + (mapRow * mapWidth)

      ret[mapIndex] = segments[CENTER_SEGMENT_INDEX].tiles[segIndex]
    }
  }

  return ret
}
