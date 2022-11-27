// The Primary Game.  Viewing the Game Board.
import { Scene3D } from '@enable3d/phaser-extension'
import { THREE } from 'enable3d'
import { createGrid } from './grid'
import {
	store,
	Tile,
	BoardSize,
	BoardRect,
	GameBoardSegment,
} from '../../store'

export default class GameBoardScene extends Scene3D {
  constructor() {
    super({ key: 'GameBoardScene' })
  }

  init() {
    this.accessThirdDimension()
  }

  create() {
    // creates a nice scene
    this.third.warpSpeed(
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
			'sky',

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
		// TODO add in some other setup, like input controls.
		//const camera = new THREE.PerspectiveCamera(27, window.innerWidth / window.innerHeight, 1, 3500)
		//camera.position.z = 2750

		// Lighting
		this.third.scene.add( new THREE.AmbientLight(0x444444))
		const light1 = new THREE.DirectionalLight(0xffffff, 0.5)
		light1.position.set( 1, 1, 1 )
		this.third.scene.add(light1)
		const light2 = new THREE.DirectionalLight(0xffffff, 1.5)
		light2.position.set(0, - 1, 0)
		this.third.scene.add(light2)

		/*
    // adds a box
    this.third.add.box({ x: 1, y: 2 })

    // adds a box with physics
    this.third.physics.add.box({ x: -1, y: 2 })

    // throws some random object on the scene
    this.third.haveSomeFun()
		*/

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
		const hexColumns = 10
		const hexRows = 10
		const boardDim: BoardRect = {
			minX: -(3 * hexColumns), maxX: (3 * hexColumns),
			minY: -(2 * hexRows), maxY: (2 * hexRows),
		}
		const segmentSize: BoardSize = {width: 3 * hexColumns, height: 2 * hexRows}
		const segments: GameBoardSegment[] = []
		const colors = [
			[1, 0, 0],
			[0, 1, 0],
			[0, 0, 1],
			[1, 1, 0],
			[1, 0, 1],
			[0, 1, 1],
		]
		for (let segY = -1; segY <= 1; segY++) {
			for (let segX = -1; segX <= 1; segX++) {
				const tiles = new Array<Tile>(segmentSize.width * segmentSize.height)
				const segment: GameBoardSegment = {
					position: {
						x: segX * segmentSize.width - (segmentSize.width >> 1),
						y: segY * segmentSize.height - (segmentSize.height >> 1),
					},
					tiles,
				}
				segments.push(segment)
				for (let tileY = 0; tileY < segmentSize.height; tileY++) {
					for (let tileX = 0; tileX < segmentSize.width; tileX++) {
						const tileIndex = tileX + (tileY * segmentSize.width)
						let category: string | null = null
						let height = Math.random() * 5 | 0
						let rgb: number[]

						// Make it look like a hex tile.
						let hexRowPart = tileY % 2
						let startHexCol = tileX - (tileX % 3)
						let endHexCol = startHexCol + 3
						let startHexRow: number
						if ((tileX % 6) < 3) {
							// Type A
							startHexRow = tileY - hexRowPart
						} else {
							// Type B
							startHexRow = tileY - (1 - hexRowPart)
						}
						let endHexRow = startHexRow + 2
						if (
								startHexRow >= 0 && startHexCol >= 0 &&
								endHexCol < segmentSize.width && endHexRow < segmentSize.height
						) {
							// It's a valid hex location.
							const tokenColumn = startHexCol / 3
							const tokenRow = startHexRow >> 1
							if (startHexCol === tileX && startHexRow === tileY) {
								// Create the tile whole cloth
								console.log(`(${tokenColumn}, ${tokenRow}) create (${startHexCol}, ${startHexRow})`)
								category = "grassland"
								rgb = colors[(tokenColumn + (tokenRow * hexColumns)) % colors.length]
							} else {
								// Copy the tile
								console.log(`(${tokenColumn}, ${tokenRow}) : copy (${startHexCol}, ${startHexRow}) -> (${tileX}, ${tileY})`)
								const hexIndex = startHexCol + (startHexRow * segmentSize.width)
								category = tiles[hexIndex].category
								height = tiles[hexIndex].height
								rgb = tiles[hexIndex].rgb
							}
						}
						tiles[tileIndex] = {
							category,
							height,
							rgb,
							parameters: [],
						}
					}
				}
			}
		}

		this.third.scene.add(createGrid(
			// state.gameBoard.segments,
			// state.gameBoard.segmentSize,
			// state.gameBoard.size,

			segments,
			segmentSize,
			boardDim,
		))
	}

  update() {}

	stateUpdated() {
		// store.dispatch(animationsDone())
	}
}
