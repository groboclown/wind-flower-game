// The Primary Game.  Viewing the Game Board.
import { Scene3D, ExtendedObject3D } from '@enable3d/phaser-extension'
import { THREE } from 'enable3d'
import { createGrid, GridBoard3D } from './grid'
import { createCameraInputControls } from './input'
import { CameraInput } from './input/camera-input'
import {
  store,
  // Tile,
  BoardSize,
  // BoardRect,
  // GameBoardSegment,
} from '../../store'
import { createAlternatingBoard, createBoardRect } from './test-data'


export default class GameBoardScene extends Scene3D {
  private grid: GridBoard3D | null
	private controls: CameraInput | null

  private tmpFocusBox: ExtendedObject3D | null
  private tmpLastMouse: THREE.Vector2
  private tmpHightlightLine: THREE.Line | null
  private tmpMouseUpdated: boolean

  constructor() {
    super({ key: 'GameBoardScene' })
		this.grid = null
		this.controls = null
    this.tmpFocusBox = null
    this.tmpLastMouse = new THREE.Vector2()
    this.tmpHightlightLine = null
    this.tmpMouseUpdated = false
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
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => self.onPointerMoved(pointer))

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
    const material = new THREE.LineBasicMaterial({color: 0xffffff, transparent: true})
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
    let drawLine = false
    if (this.grid && this.tmpHightlightLine && this.tmpMouseUpdated) {
      this.tmpMouseUpdated = false
      const raycaster = new THREE.Raycaster()
      // update the picking ray with the camera and pointer position
      raycaster.setFromCamera(this.tmpLastMouse, this.third.camera)
      const intersects = raycaster.intersectObject(this.grid.object)
      if (intersects.length > 0) {
        const intersect = intersects[0]
        //const faceIndex = intersect.faceIndex
        const face = intersect.face
        if (face) {
          const tokenId = this.grid.vertexToTokenId[face.a]
          const hexPositions = this.grid.tokenIdHexagonShape[tokenId]
          if (hexPositions !== undefined) {
            console.debug(`Highlight face ${face.a} -> token ${tokenId}`)
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
          } else {
            console.debug(`No hex position for face ${face.a} -> token ${tokenId}`)
          }
        } else {
          console.debug(`No face index ${face}`)
        }
      }
      this.tmpHightlightLine.visible = drawLine
    }
  }

  private onPointerMoved(pointer: Phaser.Input.Pointer) {
    // console.log(`pointer moved! ${Object.keys(pointer)}`)
    // Calculate pointer position in normalized device coordinates
	  //   (-1 to +1) for both components

    if (this.tmpLastMouse) {
      const mouseWidth = this.game.canvas.width
      const mouseHeight = this.game.canvas.height
      const mouseX = (pointer.position.x / mouseWidth) * 2 - 1
      const mouseY = 1 - ((pointer.position.y / mouseHeight) * 2)
      if (mouseX !== this.tmpLastMouse.x || mouseY !== this.tmpLastMouse.y) {
        this.tmpMouseUpdated = true
        this.tmpLastMouse?.set(
          mouseX,
          mouseY,
        )
      }
    }

    if (this.controls) {
      // console.debug('Running controls update')
      this.onControlsUpdated()
    }
  }

  stateUpdated() {
		// console.debug('Running state updated')
    // store.dispatch(animationsDone())
  }
}
