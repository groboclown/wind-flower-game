// Create the grid mesh.
import { THREE, ExtendedMesh, ExtendedObject3D } from 'enable3d'
import { TextureHandler } from './texture-handler'
import { sortGameBoardSegments } from '../../lib/board-helper/sort'
import {
  ClientGameBoard,
  ClientGameBoardSegment,
  ClientTile,
} from '../../gameboard-state'


export interface Table3D {
  readonly objects: {[keys: string]: ExtendedObject3D}
}


export interface GridBoardUserData {
  // Vertex index -> token position index
  //   For each vertex in the geometry, its index is mapped to
  //   the token ID of the original grid.
  readonly vertexToTokenId: {[key: number]: number}

  // index in the segment tile index -> vertex index
  readonly tileIndexToVertexIndex: {[key: number]: number[]}

  readonly segmentId: string
}


interface SegmentSize {
  width: number
  height: number
}


const EMPTY_TILE: ClientTile = {
  tokenId: null,
  category: null,
  variation: 0,
  height: -2,
  parameters: {},

  hasAdjacentPlacedTile: false,
  isPlayerPlaceableToken: false,
}


export function getGridBoardData(table: Table3D, segmentId: string): GridBoardUserData {
  return table.objects[segmentId].userData as GridBoardUserData
}


// createTableGrid construct a 3d model of the game board
//   Each segment is made into its own object.
export function createTableGrid(
  gameBoard: ClientGameBoard,
  meshTexture: THREE.Texture,
  textureHandler: TextureHandler,
): Table3D {

  // Order the game boards into row / column, so that
  const rowColumns = sortGameBoardSegments(gameBoard.segments)
  const emptySegmentTiles = cloneTileToBoardSegment(EMPTY_TILE, gameBoard.segmentWidth, gameBoard.segmentHeight)

  const objects: {[keys: string]: ExtendedObject3D} = {}
  for (let rowIndex = 0; rowIndex < rowColumns.length; rowIndex++) {
    const columns = rowColumns[rowIndex]
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
      // Construct the 3x3 grid to pass to the segment constructor.
      const segments: ClientGameBoardSegment[] = []
      for (let rowDelta = -1; rowDelta <= 1; rowDelta++) {
        for (let columnDelta = -1; columnDelta <= 1; columnDelta++) {
          const row = rowIndex + rowDelta
          const col = columnIndex + columnDelta
          if (row < 0 || col < 0 || row >= rowColumns.length || col >= rowColumns[row].length) {
            segments.push({
              segmentId: "",
              tiles: emptySegmentTiles,
              // position doesn't matter for the empty table.
              x: col, y: row,
            })
          } else {
            segments.push(rowColumns[row][col])
          }
        }
      }
      const key = segments[CENTER_SEGMENT_INDEX].segmentId
      objects[key] = createSegmentGrid(
        segments,
        { width: gameBoard.segmentWidth, height: gameBoard.segmentHeight },
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
  tileTemplate: ClientTile, width: number, height: number,
): ClientTile[] {
  const count = width * height
  const tiles: ClientTile[] = []
  for (let i = 0; i < count; i++) {
    tiles.push({ ...tileTemplate })
  }
  return tiles
}


// TODO look at adding an index, as each point is
// shared with up to 6 triangles.


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
  segments: ClientGameBoardSegment[],
  segmentSize: SegmentSize,
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
  const startX = (primary.x * SIDE_LENGTH_HALF)
  let column = 0
  let row = 0
  // x & z are the upper-left corner of the "square" containing the triangle.
  let x = startX
  let z = primary.y * BASE_LENGTH
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

  // MeshStandardMaterial
  // MeshPhongMaterial
  // MeshPhysicalMaterial
  const material = new THREE.MeshStandardMaterial({
    map: meshTexture,
    // specular: 0xaaaaaa,
    // shininess: 250,
    metalness: 0.5,
    blending: 1,
    side: THREE.DoubleSide,
  })

  const mesh = new ExtendedMesh(geometry, material)
  const object = new ExtendedObject3D()
  object.add(mesh)

  object.userData = {
    vertexToTokenId,
    tileIndexToVertexIndex,
    segmentId: segments[CENTER_SEGMENT_INDEX].segmentId,
  } as GridBoardUserData
  return object
}


// createHeightMap map the heights in the current segment + a 1 tile buffer around it.
function createHeightMap(
  segments: ClientGameBoardSegment[],
  segmentSize: SegmentSize,
): ClientTile[] {
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

  const ret = new Array<ClientTile>(mapWidth * mapHeight)

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
