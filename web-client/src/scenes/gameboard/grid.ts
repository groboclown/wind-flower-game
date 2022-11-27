// Create the grid mesh.
import { THREE, ExtendedMesh } from 'enable3d'
import { GameBoardSegment, BoardSize, BoardRect } from '../../store/state/board'

const SIDE_LENGTH = 1
const SIDE_LENGTH_HALF = SIDE_LENGTH / 2
const BASE_LENGTH = SIDE_LENGTH_HALF * Math.sqrt(3)
const HEIGHT_SCALE = 0.2

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
export function createGrid(
  segments: GameBoardSegment[],
  segmentSize: BoardSize,
  boardDim: BoardRect,
): ExtendedMesh {

  // Each tile in each segment is an equalateral triangle.
  // Each triangle is either even or odd, based on the calculation:
  //   odd_ness = (x + y) & 0x1
  // With this setup (labeled for the right-hand rule):
  //   Odd Triangle:
  //     A --- B
  //       \ /
  //        . C
  //   Even triangle:
  //        . C
  //     B /_\ A

  // We arrange even/odd this way so that the grid layout for a single
  // hexagon:
  //    +-----+-----+-----+
  //    | 0,0 | 1,0 | 2,0 |
  //    +-----+-----+-----+
  //    | 0,1 | 1,1 | 2,1 |
  //    +-----+-----+-----+
  // will line up with the tiles.

  // Because of this arrangement, though, even rows must be
  // shifted to the right by half.

  const triangleCount = segmentSize.width * segmentSize.height
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array( triangleCount * 3 * 3 )
	const normals = new Float32Array( triangleCount * 3 * 3 )
	const colors = new Float32Array( triangleCount * 3 * 3 )
  const color = new THREE.Color()

  const pA = new THREE.Vector3()
	const pB = new THREE.Vector3()
	const pC = new THREE.Vector3()

	const cb = new THREE.Vector3()
	const ab = new THREE.Vector3()

  const primary = segments[4]
  // We count horizontally by column to discover the even/odd
  //   position, but the "y" value is directly maintained.
  const startX = (primary.position.x * SIDE_LENGTH_HALF) + ((boardDim.maxX + boardDim.minX) / 2)
  let column = 0
  let row = 0
  let z = (primary.position.y * BASE_LENGTH) + ((boardDim.maxY + boardDim.minY) / 2)
  let vIdx = 0
  for (let tileI = 0; tileI < primary.tiles.length; tileI++) {
    const hOdd = column & 0x1
    const vOdd = row & 0x1
    const hvOdd = (row + column) & 0x1

    // The even/odd fit together such that the odd triangles take up the same X
    //   graphical position as the even ones, just flipped and offset by 1/2.
    //   We perform "x >> 1" in order to perform an integer divide.  This means
    //   the even and odd use the exact same computed values for the x/y position.

    // FIXME the generated triangles create a perfet mesh,
    //   but they aren't aligned with the hexes.  This algorithm needs to be
    //   tweaked a bunch.

    let xWiggle = SIDE_LENGTH - (vOdd * SIDE_LENGTH_HALF)

    // For now, we aren't looking at height.
    let ax = xWiggle + startX + ((column >> 1) * SIDE_LENGTH)
    let ay = primary.tiles[tileI].height * HEIGHT_SCALE
    let az = z
    let bx = ax + SIDE_LENGTH
    let by = primary.tiles[tileI].height * HEIGHT_SCALE
    let bz = az
    let cx = ax + SIDE_LENGTH_HALF
    let cy = primary.tiles[tileI].height * HEIGHT_SCALE
    let cz = az - BASE_LENGTH

    if (hOdd === 0) {
      // With some fancy math, we can push this into the above
      //   computation.  For now, be explicit.
      // new C := old B (exact translation)
      // new B := old C (exact translation)
      // A -> (x := new bx + SIDE_LENGTH), (z := new B)
      let tmpx = bx
      let tmpz = bz
      // ignore z for now
      bx = cx
      bz = cz
      cx = tmpx
      cz = tmpz
      ax = bx + SIDE_LENGTH
      az = bz
    }

    positions[vIdx] = ax;
    positions[vIdx + 1] = ay;
    positions[vIdx + 2] = az;

    positions[vIdx + 3] = bx;
    positions[vIdx + 4] = by;
    positions[vIdx + 5] = bz;

    positions[vIdx + 6] = cx;
    positions[vIdx + 7] = cy;
    positions[vIdx + 8] = cz;

    // flat face normals

    pA.set(ax, ay, az);
    pB.set(bx, by, bz);
    pC.set(cx, cy, cz);

    cb.subVectors(pC, pB);
    ab.subVectors(pA, pB);
    cb.cross(ab);

    cb.normalize();

    const nx = cb.x;
    const ny = cb.y;
    const nz = cb.z;

    normals[vIdx] = nx;
    normals[vIdx + 1] = ny;
    normals[vIdx + 2] = nz;

    normals[vIdx + 3] = nx;
    normals[vIdx + 4] = ny;
    normals[vIdx + 5] = nz;

    normals[vIdx + 6] = nx;
    normals[vIdx + 7] = ny;
    normals[vIdx + 8] = nz;

    // colors (in range 0-1)

    if (primary.tiles[tileI].category === null) {
      // How to set the alpha chanel on the triangle?
      color.setRGB(1, 1, 1)
    } else {
      color.setRGB(primary.tiles[tileI].rgb[0], primary.tiles[tileI].rgb[1], primary.tiles[tileI].rgb[2]);
    }

    colors[vIdx] = color.r;
    colors[vIdx + 1] = color.g;
    colors[vIdx + 2] = color.b;

    colors[vIdx + 3] = color.r;
    colors[vIdx + 4] = color.g;
    colors[vIdx + 5] = color.b;

    colors[vIdx + 6] = color.r;
    colors[vIdx + 7] = color.g;
    colors[vIdx + 8] = color.b;


    vIdx += 3 * 3
    column++
    if (column >= segmentSize.width) {
      row++
      column = 0
      z += BASE_LENGTH
    }
  }
  const rowlen = segmentSize.width * 3 * 3
  console.log(`Hex 0 (0, 0): (${positions[ 0]}, ${positions[ 1]}, ${positions[ 2]}) (${positions[ 3]}, ${positions[ 4]}, ${positions[ 5]}) (${positions[ 6]}, ${positions[ 7]}, ${positions[ 8]})`)
  console.log(`Hex 0 (1, 0): (${positions[ 9]}, ${positions[10]}, ${positions[11]}) (${positions[12]}, ${positions[13]}, ${positions[14]}) (${positions[15]}, ${positions[16]}, ${positions[17]})`)
  console.log(`Hex 0 (2, 0): (${positions[18]}, ${positions[19]}, ${positions[20]}) (${positions[21]}, ${positions[22]}, ${positions[23]}) (${positions[24]}, ${positions[25]}, ${positions[26]})`)
  console.log(`Hex 0 (0, 1): (${positions[ 0+rowlen]}, ${positions[ 1+rowlen]}, ${positions[ 2+rowlen]}) (${positions[ 3+rowlen]}, ${positions[ 4+rowlen]}, ${positions[ 5+rowlen]}) (${positions[ 6+rowlen]}, ${positions[ 7+rowlen]}, ${positions[ 8+rowlen]})`)
  console.log(`Hex 0 (1, 1): (${positions[ 9+rowlen]}, ${positions[10+rowlen]}, ${positions[11+rowlen]}) (${positions[12+rowlen]}, ${positions[13+rowlen]}, ${positions[14+rowlen]}) (${positions[15+rowlen]}, ${positions[16+rowlen]}, ${positions[17+rowlen]})`)
  console.log(`Hex 0 (2, 1): (${positions[18+rowlen]}, ${positions[19+rowlen]}, ${positions[20+rowlen]}) (${positions[21+rowlen]}, ${positions[22+rowlen]}, ${positions[23+rowlen]}) (${positions[24+rowlen]}, ${positions[25+rowlen]}, ${positions[26+rowlen]})`)
  console.log(`Last tile: (${positions[positions.length-3]}, ${positions[positions.length-2]}, ${positions[positions.length-1]})`)

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  geometry.computeBoundingSphere()

  let material = new THREE.MeshPhongMaterial({
    color: 0xaaaaaa, specular: 0xffffff, shininess: 250,
    side: THREE.DoubleSide, vertexColors: true
  })

  const mesh = new ExtendedMesh(geometry, material)
  return mesh
}
