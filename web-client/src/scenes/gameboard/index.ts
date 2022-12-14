// The Primary Game.  Viewing the Game Board.
import { Scene3D, ExtendedObject3D } from '@enable3d/phaser-extension'
import { THREE } from 'enable3d'
import { createGrid, GridBoard3D } from './grid'
import { createCameraInputControls } from './input'
import {
  CameraInput,
  CAMERA_POINTER_MOVED,
  CAMERA_POINTER_SELECTION,
  CAMERA_SELECTION_MOVED,
} from './input'
import { GAMEBOARD_SCENE_NAME } from '../names'
import {
  store,
  // Tile,
  BoardSize,
  // BoardRect,
  // GameBoardSegment,
  gameBoardTokenSelected,
  gameBoardTokenDeSelected,
  gameBoardTokenHoverOver,
} from '../../store'
import { createAlternatingBoard, createBoardRect } from './test-data'


export default class GameBoardScene extends Scene3D {
  private grid: GridBoard3D | null
	private controls: CameraInput | null

  private tmpFocusBox: ExtendedObject3D | null
  private tmpHightlightLine: THREE.Line | null

  private hoveredTokenId: number | null

  private selectedTokenId: number | null

  constructor() {
    super({ key: GAMEBOARD_SCENE_NAME })
		this.grid = null
		this.controls = null
    this.tmpFocusBox = null
    this.tmpHightlightLine = null

    this.hoveredTokenId = null
    this.selectedTokenId = null
  }

  init() {
    this.accessThirdDimension()
  }

  create(): void {
    const self = this

    // Creates a nice scene.  Ignore the promise.
    void this.third.warpSpeed(
      // Places:
      // a hemisphere light
      // an ambient light

      // a camera in position (0, 6, 12)
      'camera',
    )
		// Input Controls
    this.controls = createCameraInputControls(this)
    this.controls.setPolarAngleBounds(0, Math.PI / 3)
    this.controls.setZoomBounds(3, 20)
    this.input.on(CAMERA_POINTER_MOVED, (x: number, y: number) => self.onCameraPointerMoved(x, y))
    this.input.on(CAMERA_POINTER_SELECTION, (x: number, y: number) => self.onCameraPointerSelected(x, y))
    this.input.on(CAMERA_SELECTION_MOVED, (change: THREE.Vector3) => self.onCameraSelectionMoved(change))

		// this.third.camera.position.set(-20, 6, 0)
		// this.third.camera.lookAt(this.third.scene.position)
    this.controls.positionAt(new THREE.Vector3(-20, 6, 0))
    // this.controls.lookAt(this.third.scene.position)
    this.controls.lookAt(new THREE.Vector3(-14, 0, 2))

    // Background
    this.third.scene.background = new THREE.Color(0x010101)

		// Fog
		// color, near distance, far distance
		this.third.scene.fog = new THREE.Fog(0x0a0a0a, 10, 200)

    // Lighting
    this.third.scene.add(new THREE.AmbientLight(0x444444))
    const light1 = new THREE.DirectionalLight(0xffffff, 0.5)
    light1.position.set(1, 1, 1)
    this.third.scene.add(light1)
    const light2 = new THREE.DirectionalLight(0xffffff, 1.5)
    light2.position.set(0, - 1, 0)
    this.third.scene.add(light2)

    // show where the camera is pointing
    this.tmpFocusBox = this.third.add.box({
      x: -14,
      y: 5,
      z: 2,
      width: .2,
      height: 10,
      depth: .2,
    })

    this.updateHexGrid()

    // Start listening for changes
    store.subscribe(() => this.stateUpdated())
  }

  // updateHexGrid when the segments update, they need to be rerendered.
  updateHexGrid() {
    // TODO use the state to render it all.
    // const state = store.getState()

    // TODO this should be loaded from the server.
    //   Nothing should modify the state data.
    //   This is hard-coded for now.
    const boardSize: BoardSize = {width: 3 * 10, height: 2 * 10}
    const boardRect = createBoardRect(boardSize)
    const boardSegments = createAlternatingBoard(boardSize)

    for (let i = 0; i < boardSegments.length; i++) {
      console.log(`Segment ${i} sized ${boardSegments[i].tiles.length}`)
    }
		this.grid = createGrid(
      boardSegments,
      boardSize,
      boardRect,
    )
    this.third.scene.add(this.grid.object)
		this.third.physics.add.existing(this.grid.object)
		this.grid.object.body.setCollisionFlags(1)  // STATIC

    // Highlight line to show where the mouse is pointing
    // This is a line around the hexagon, so 7 points on the line to wrap around the whole thing.
    // Change to 4 for triangles.
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(7 * 3), 3))
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, linewidth: 3 })
    this.tmpHightlightLine = new THREE.Line(lineGeometry, material)
    const lineObj = new ExtendedObject3D()
    lineObj.add(this.tmpHightlightLine)
    this.third.scene.add(lineObj)
  }

  update() {
		// console.debug('Running update')
    this.onControlsUpdated()
    this.controls?.onUpdate()
    this.events.emit('addScore')
	}

  private onControlsUpdated() {
    if (this.controls && this.tmpFocusBox) {
      this.tmpFocusBox.position.copy(this.controls.getTarget())
    }
  }

  private onCameraPointerMoved(x: number, y: number) {
    // console.log(`pointer moved! ${Object.keys(pointer)}`)
    // Calculate pointer position in normalized device coordinates
	  //   (-1 to +1) for both components

    // console.log(`last mouse position set at (${x}, ${y})`)
    if (this.grid && this.tmpHightlightLine) {
      const nextHoveredTokenId = this.findIntersectedTokenId(x, y)

      // console.log(`hovered token: ${this.currentlyHoveredTokenId} -> ${this.nextHoveredTokenId}`)
      if (this.hoveredTokenId !== nextHoveredTokenId) {
        console.log(`changing hovered token: ${this.hoveredTokenId} -> ${nextHoveredTokenId}`)

        let drawLine = false
        if (nextHoveredTokenId !== null) {
          const hexPositions = this.grid.tokenIdHexagonShape[nextHoveredTokenId]
          if (hexPositions !== undefined) {
            const linePosition = this.tmpHightlightLine.geometry.attributes.position as THREE.BufferAttribute

            // Draw a hexagon.  7 points, meaning the first -> last.
            linePosition.setXYZ(6, hexPositions[ 0], hexPositions[ 1], hexPositions[ 2])
            linePosition.setXYZ(0, hexPositions[ 0], hexPositions[ 1], hexPositions[ 2])
            // console.debug(` -> ${tokenIndex + 0} : ${this.grid.tokenPositions.getX(tokenIndex + 0)}, ${this.grid.tokenPositions.getY(tokenIndex + 0)}`)
            linePosition.setXYZ(1, hexPositions[ 3], hexPositions[ 4], hexPositions[ 5])
            linePosition.setXYZ(2, hexPositions[ 6], hexPositions[ 7], hexPositions[ 8])
            linePosition.setXYZ(3, hexPositions[ 9], hexPositions[10], hexPositions[11])
            linePosition.setXYZ(4, hexPositions[12], hexPositions[13], hexPositions[14])
            linePosition.setXYZ(5, hexPositions[15], hexPositions[16], hexPositions[17])

            this.grid.object.updateMatrix()
            this.tmpHightlightLine.geometry.applyMatrix4(this.grid.object.matrix)
            drawLine = true
          }
        }
        this.tmpHightlightLine.visible = drawLine

        this.hoveredTokenId = this.hoveredTokenId
        store.dispatch(gameBoardTokenHoverOver({ tokenId: nextHoveredTokenId }))
      }
    }

    if (this.controls) {
      // console.debug('Running controls update')
      this.onControlsUpdated()
    }
  }

  private onCameraPointerSelected(x: number, y: number) {
    // console.log(`Clicked on ${x}, ${y}`)
    if (this.grid) {
      const nextSelected = this.findIntersectedTokenId(x, y)

      // console.log(`selected token: ${this.currentlySelectedTokenId} -> ${this.nextSelectedTokenId}`)
      if (this.selectedTokenId !== nextSelected) {
        console.log(`changing selected token: ${this.selectedTokenId} -> ${nextSelected}`)

        // TODO add a decal on the selected token to indicate it's highlighted.
        // That's probably what the hover display will become, too.

        this.selectedTokenId = nextSelected
        if (this.selectedTokenId !== null) {
          store.dispatch(gameBoardTokenSelected({ tokenId: this.selectedTokenId }))
        } else {
          store.dispatch(gameBoardTokenDeSelected({}))
        }
      }
    }

  }

  private onCameraSelectionMoved(change: THREE.Vector3) {
    console.log(`Move selection along ${change.x}, ${change.z}`)
  }

  private findIntersectedTokenId(x: number, y: number): number | null {
    if (this.grid) {
      const raycaster = new THREE.Raycaster()
      // update the picking ray with the camera and pointer position
      raycaster.setFromCamera({x, y}, this.third.camera)
      const intersects = raycaster.intersectObject(this.grid.object)
      if (intersects.length > 0) {
        const intersect = intersects[0]
        //const faceIndex = intersect.faceIndex
        const face = intersect.face
        if (face) {
          const tokenId = this.grid.vertexToTokenId[face.a]
          if (tokenId === undefined) {
            return null
          }
          // console.debug(`(${x}, ${y}) intersected face ${face.a} -> token ${tokenId}`)
          return tokenId
        }
      }
    }
    return null
  }

  stateUpdated() {
		// console.debug('Running state updated')
    // store.dispatch(animationsDone())
  }
}
