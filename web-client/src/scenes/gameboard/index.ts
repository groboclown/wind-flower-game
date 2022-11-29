// The Primary Game.  Viewing the Game Board.
import { Scene3D, ExtendedObject3D } from '@enable3d/phaser-extension'
import { THREE } from 'enable3d'
import { createGrid } from './grid'
import { Controls, createControls } from './input'
import {
  store,
  // Tile,
  BoardSize,
  // BoardRect,
  // GameBoardSegment,
} from '../../store'
import { createAlternatingBoard, createBoardRect } from './test-data'

export default class GameBoardScene extends Scene3D {
	private gridBoard: ExtendedObject3D | null
	private controls: Controls | null

  constructor() {
    super({ key: 'GameBoardScene' })
		this.gridBoard = null
		this.controls = null
  }

  init() {
    this.accessThirdDimension()
  }

  create(): void {
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
      'orbitControls',

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

		this.third.camera.position.set(-20, 6, 0)
		this.third.camera.lookAt(this.third.scene.position)

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
		const grid = createGrid(
      // state.gameBoard.segments,
      // state.gameBoard.segmentSize,
      // state.gameBoard.size,

      boardSegments,
      boardSize,
      boardRect,
    )
		this.gridBoard = new ExtendedObject3D()
		this.gridBoard.add(grid)
    this.third.scene.add(this.gridBoard)
		this.third.physics.add.existing(this.gridBoard)
		this.gridBoard.body.setCollisionFlags(1)  // STATIC
  }

  update() {
		console.debug('Running update')
		this.controls?.update()
	}

  stateUpdated() {
		console.debug('Running state updated')
    // store.dispatch(animationsDone())
  }
}
