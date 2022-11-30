// The Primary Game.  Viewing the Game Board.
import { Scene3D, ExtendedObject3D } from '@enable3d/phaser-extension'
import { THREE } from 'enable3d'
import { createGrid, GridBoard3D } from './grid'
import { Controls, createControls } from './input'
import {
  store,
  // Tile,
  BoardSize,
  // BoardRect,
  // GameBoardSegment,
} from '../../store'
import { createAlternatingBoard, createBoardRect } from './test-data'


interface MouseMovedEvent {
  // manager
  // id
  // camera
  button: number
  buttons: number,
  position: {x: number, y: number}
  prevPosition: {x: number, y: number}
  midPoint: {x: number, y: number}
  velocity: {x: number, y: number}
  angle: number
  distance: number
  smoothFactor: number
  motionFactor: number
  worldX: number
  worldY: number
  moveTime: number
  downX: number
  downY: number
  downTime: number
  upX: number
  upY: number
  upTime: number
  primaryDown: number
  isDown(): boolean
  wasTouch(): boolean
  wasCanceled(): boolean
  movementX: number
  movementY: number
  deltaX: number
  deltaY: number
  deltaZ: number
  //,identifier,pointerId,active,locked,,event
}

export default class GameBoardScene extends Scene3D {
  private grid: GridBoard3D | null
	private controls: Controls | null

  private tmpFocusBox: ExtendedObject3D | null
  private tmpLastMouse: THREE.Vector2
  private tmpHightlightLine: THREE.Line | null

  constructor() {
    super({ key: 'GameBoardScene' })
		this.grid = null
		this.controls = null
    this.tmpFocusBox = null
    this.tmpLastMouse = new THREE.Vector2()
    this.tmpHightlightLine = null
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
      // a directional light, positioned at (100, 200, 50)
      // 'light',

      // a camera in position (0, 6, 12)
      'camera',

      // make the camera look at the scene's initial position
      //'lookAtCenter',

      // include a Mesh and a set of shaders to simulate the effect of an azure sky
      // 'sky',

      // include a set of controllers to allow the camera to orbit around a target.
      // 'orbitControls',

      // create a ground platform in the scene.
      //   The ground platform measures 21x21x1, and it is positioned 0.5 under the origin.
      //   By default, the ground platform is not texturized.
      // 'ground',

      // texturize the ground platform with a grid composed of white 1x1 squares with a black border,
      //   only if the ground is present.
      // 'grid',
    )
		// Input Controls
    this.controls = createControls(this)
    this.controls.registerOnUpdateListener((controls: Controls) => self.onControlsUpdated(controls))
    this.input.on('pointermove', (event: MouseMovedEvent) => self.onPointerMoved(event))

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

    /*
    // adds a box
    this.third.add.box({ x: 1, y: 2 })

    // adds a box with physics
    this.third.physics.add.box({ x: -1, y: 2 })

    */

    this.updateHexGrid()

    // throws some random object on the scene
		// this.third.haveSomeFun()

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
      // state.gameBoard.segments,
      // state.gameBoard.segmentSize,
      // state.gameBoard.size,

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
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3))
    const material = new THREE.LineBasicMaterial({color: 0xffffff, transparent: true})
    this.tmpHightlightLine = new THREE.Line(lineGeometry, material)
    const lineObj = new ExtendedObject3D()
    lineObj.add(this.tmpHightlightLine)
    this.third.scene.add(lineObj)
  }

  update() {
		// console.debug('Running update')
    this.controls?.update()
	}

  private onControlsUpdated(controls: Controls) {
    this.tmpFocusBox?.position.copy(controls.getTarget())
    let drawLine = false
    if (this.grid && this.tmpHightlightLine) {
      const raycaster = new THREE.Raycaster()
      // update the picking ray with the camera and pointer position
      raycaster.setFromCamera(this.tmpLastMouse, this.third.camera)
      const intersects = raycaster.intersectObject(this.grid.object)
      if (intersects.length > 0) {
        const intersect = intersects[0]
        //const faceIndex = intersect.faceIndex
        const face = intersect.face

        if (face) {
          const tokenIndex = this.grid.positionIndexToTokenIndex[face.a]
          const positionIndicies = this.grid.tokenIndexToFaceIndex[tokenIndex]
          if (positionIndicies !== null) {
            console.debug(`Highlight face ${face} -> token ${tokenIndex} : ${JSON.stringify(positionIndicies)}`)
            const linePosition = this.tmpHightlightLine.geometry.attributes.position as THREE.BufferAttribute
            const meshPosition = this.grid.geometry.attributes.position as THREE.BufferAttribute

            // Draw a triangle
            linePosition.copyAt(0, meshPosition, face.a)
            linePosition.copyAt(1, meshPosition, face.b)
            linePosition.copyAt(2, meshPosition, face.c)
            linePosition.copyAt(3, meshPosition, face.a)

            // Draw a hexagon
            // The face indicies are already arranged in the draw order.
            //for (let i = 0; i <= positionIndicies.length; i++) {
            //  const j = i % positionIndicies.length
            //  // i is the linePosition destination, j is the source.
            //  // This repeats the first point, so make sure j wraps around.
            //  linePosition.copyAt(i, meshPosition, positionIndicies[j])
            //}

            this.grid.object.updateMatrix()
            this.tmpHightlightLine.geometry.applyMatrix4( this.grid.object.matrix )
            drawLine = true

            // console.debug(`Highlight face ${intersect.faceIndex}: points ${face.a}/${face.b}/${face.c}`)
        } else {
            console.debug(`No face index ${face} / token index ${tokenIndex}`)
          }



          /* draw the token
          if (positionIndicies) {
            const linePosition = this.tmpHightlightLine.geometry.attributes.position as THREE.BufferAttribute
            const meshPosition = this.grid.geometry.attributes.position as THREE.BufferAttribute


            this.grid.object.updateMatrix()

            this.tmpHightlightLine.geometry.applyMatrix4( this.grid.object.matrix )
            drawLine = true
          }
          */
        }
      }
      this.tmpHightlightLine.visible = drawLine
    }
  }

  private onPointerMoved(pointer: MouseMovedEvent) {
    // console.log(`pointer moved! ${Object.keys(pointer)}`)
    // Calculate pointer position in normalized device coordinates
	  //   (-1 to +1) for both components

    const mouseWidth = this.game.canvas.width
    const mouseHeight = this.game.canvas.height
    this.tmpLastMouse?.set(
      //(pointer.position.x / window.innerWidth) * 2 - 1,
      (pointer.position.x / mouseWidth) * 2 - 1,
      //(pointer.position.y / window.innerHeight) * 2 + 1,
      1 - ((pointer.position.y / mouseHeight) * 2),
    )

    if (this.controls) {
      // console.debug('Running controls update')
      this.onControlsUpdated(this.controls)
    }
  }

  stateUpdated() {
		// console.debug('Running state updated')
    // store.dispatch(animationsDone())
  }
}
