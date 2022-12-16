// The Primary Game.  Viewing the Game Board.
import { Scene3D, ExtendedObject3D } from '@enable3d/phaser-extension'
import { THREE } from 'enable3d'
import { createGrid, GridBoard3D } from './grid'
import { createCameraInputControls } from './input'
import { TextureHandler } from './texture-handler'
import { getCachedTexture } from '../../lib/cache/texture'
import {
  CameraInput,
  CAMERA_POINTER_MOVED,
  CAMERA_POINTER_SELECTION,
  CAMERA_SELECTION_MOVED,
} from './input'
import { GAMEBOARD_SCENE_NAME } from '../names'
import {
  store,
  Tile,
  BoardSize,
  // BoardRect,
  GameBoardState,
  gameBoardTokenSelected,
  gameBoardTokenDeSelected,
  gameBoardTokenHoverOver,
} from '../../store'
import { createAlternatingBoard, createBoardRect } from './test-data'


interface HexToken {
  // length === 6
  tiles: number[][]
  // indicies for each of the 6 faces.
  // face 0 -> 0, 1, 2
  // face 1 -> 3, 4, 5
  // ...
  tokenId: number | null
}


interface IntersectedTile {
  object: ExtendedObject3D
  tokenId: number
  tileIds: number[][]
}


export default class GameBoardScene extends Scene3D {
  private grid: GridBoard3D | null
	private controls: CameraInput | null
  private raycaster: THREE.Raycaster
  private textureHandler: TextureHandler | null

  private hoverToken: HexToken
  private selectToken: HexToken

  // until we get something real
  private gameBoardState: GameBoardState


  constructor() {
    super({ key: GAMEBOARD_SCENE_NAME })
		this.grid = null
		this.controls = null
    this.raycaster = new THREE.Raycaster()
    this.textureHandler = null

    this.hoverToken = {
      tiles: [[], [], [], [], [], []],
      tokenId: null,
    }
    this.selectToken = {
      tiles: [[], [], [], [], [], []],
      tokenId: null,
    }

    // TODO use the state to render it all.
    // const state = store.getState()

    // TODO this should be loaded from the server.
    //   Nothing should modify the state data.
    //   This is hard-coded for now.
    const boardSize: BoardSize = {width: 3 * 10, height: 2 * 10}
    const boardSegments = createAlternatingBoard(boardSize)
    const tokenIdMap: {[key: number]: number[][]} = {}
    for (let segI = 0; segI < boardSegments.length; segI++) {
      for (let idx = 0; idx < boardSegments[segI].tiles.length; idx++) {
        const tokenId = boardSegments[segI].tiles[idx].tokenId
        if (tokenId !== null) {
          let tiles = tokenIdMap[tokenId]
          if (tiles === undefined) {
            tiles = []
            tokenIdMap[tokenId] = tiles
          }
          tiles.push([segI, idx])
        }
      }
    }

    this.gameBoardState = {
      size: {minX: 0, maxX: boardSize.width, minY: 0, maxY: boardSize.height},
      segmentIndexX: [],
      segmentIndexY: [],
      segments: boardSegments,
      segmentSize: boardSize,
      tokenIdMap,
    }
  }

  init() {
    this.accessThirdDimension()
  }

  create(): void {
    const self = this

    const defaultLookAt = new THREE.Vector3(-14, 0, 2)
		this.third.camera.position.set(0, 6, 12)
		// this.third.camera.lookAt(defaultLookAt)

    // Input Controls
    this.controls = createCameraInputControls(this)
    this.controls.setPolarAngleBounds(0, Math.PI / 3)
    this.controls.setZoomBounds(3, 20)
    this.input.on(CAMERA_POINTER_MOVED, (x: number, y: number) => self.onCameraPointerMoved(x, y))
    this.input.on(CAMERA_POINTER_SELECTION, (x: number, y: number) => self.onCameraPointerSelected(x, y))
    this.input.on(CAMERA_SELECTION_MOVED, (change: THREE.Vector3) => self.onCameraSelectionMoved(change))

    this.controls.positionAt(new THREE.Vector3(-20, 6, 0))
    this.controls.lookAt(defaultLookAt)

    // Background
    this.third.scene.background = new THREE.Color(0x0a0a0a)

		// Fog
		// color, near distance, far distance
    // Its color matches the background.
		this.third.scene.fog = new THREE.Fog(0x0a0a0a, 10, 100)

    // Lighting
    this.third.scene.add(new THREE.AmbientLight(0x444444, 1.0))
    const light1 = new THREE.DirectionalLight(0xffffff, 1.5)
    light1.position.set(1, 1, 1)
    this.third.scene.add(light1)

    // Create the selection stuff.
    this.textureHandler = new TextureHandler(this.cache.json.get('mesh-uv-map'))

    this.updateHexGrid()

    // Start listening for changes
    store.subscribe(() => this.stateUpdated())
  }

  // updateHexGrid when the segments update, they need to be rerendered.
  updateHexGrid() {
    if (this.textureHandler === null) {
      throw new Error('did not initialize')
    }

    const boardRect = createBoardRect(this.gameBoardState.segmentSize)
    const meshTexture = getCachedTexture(this, 'mesh-texture')
    meshTexture.mapping = THREE.UVMapping

    // for (let i = 0; i < this.gameBoardState.segments.length; i++) {
    //   console.log(`Segment ${i} sized ${this.gameBoardState.segments[i].tiles.length}`)
    // }
		this.grid = createGrid(
      this.gameBoardState.segments,
      this.gameBoardState.segmentSize,
      boardRect,
      meshTexture,
      this.textureHandler,
    )

    this.third.scene.add(this.grid.object)
		this.third.physics.add.existing(this.grid.object)
		this.grid.object.body.setCollisionFlags(1)  // STATIC
  }

  update() {
    this.controls?.onUpdate()
    this.events.emit('addScore')
	}

  private onCameraPointerMoved(x: number, y: number) {
    // Calculate pointer position in normalized device coordinates
	  //   (-1 to +1) for both components

    // console.log(`last mouse position set at (${x}, ${y})`)
    if (this.grid) {
      const nextHovered = this.findIntersectedTokenId(x, y)
      const nextHoveredTokenId = (nextHovered === null) ? null : nextHovered.tokenId

      // console.log(`hovered token: ${this.currentlyHoveredTokenId} -> ${this.nextHoveredTokenId}`)
      if (this.hoverToken.tokenId !== nextHoveredTokenId) {
        // console.log(`changing hovered token: ${this.hoverToken.tokenId} -> ${nextHoveredTokenId}`)
        const lastTokenId = this.hoverToken.tokenId
        const lastTokenTiles = this.hoverToken.tiles
        if (nextHovered !== null) {
          this.hoverToken.tiles = nextHovered.tileIds
          this.hoverToken.tokenId = nextHoveredTokenId
        } else {
          this.hoverToken.tokenId = null
        }

        if (lastTokenId !== null) {
          // Refresh the last one to the standard state.
          for (let i = 0; i < 6; i++) {
            const tilePos = lastTokenTiles[i]
            const tile = this.gameBoardState.segments[tilePos[0]].tiles[tilePos[1]]
            this.changeTexture({
              vertexIndicies: this.grid.tileIndexToVertexIndex[tilePos[1]],
              tile,
              hexIndex: i,
            })
          }
        }

        if (nextHovered !== null && nextHoveredTokenId !== null) {
          for (let i = 0; i < 6; i++) {
            const tilePos = this.hoverToken.tiles[i]
            const tile = this.gameBoardState.segments[tilePos[0]].tiles[tilePos[1]]
            this.changeTexture({
              vertexIndicies: this.grid.tileIndexToVertexIndex[tilePos[1]],
              tile,
              hexIndex: i,
            })
          }
        }
        store.dispatch(gameBoardTokenHoverOver({ tokenId: nextHoveredTokenId }))
      }
    }
  }

  private onCameraPointerSelected(x: number, y: number) {
    // console.log(`Clicked on ${x}, ${y}`)
    if (this.grid) {
      const nextSelected = this.findIntersectedTokenId(x, y)
      const nextSelectedTokenId = (nextSelected === null) ? null : nextSelected.tokenId
      if (this.selectToken.tokenId !== nextSelectedTokenId) {
        // Change the selection; maybe to nothing.
        const lastTokenId = this.selectToken.tokenId
        const lastTokenTiles = this.selectToken.tiles
        if (nextSelected !== null) {
          this.selectToken.tokenId = nextSelected.tokenId
          this.selectToken.tiles = nextSelected.tileIds
        } else {
          this.selectToken.tokenId = null
        }

        if (lastTokenId !== null) {
          // Refresh the last one to the standard state.
          for (let i = 0; i < 6; i++) {
            const tilePos = lastTokenTiles[i]
            const tile = this.gameBoardState.segments[tilePos[0]].tiles[tilePos[1]]
            this.changeTexture({
              vertexIndicies: this.grid.tileIndexToVertexIndex[tilePos[1]],
              tile,
              hexIndex: i,
            })
          }
        }

        if (nextSelected !== null && nextSelectedTokenId !== null) {
          for (let i = 0; i < 6; i++) {
            const tilePos = this.selectToken.tiles[i]
            const tile = this.gameBoardState.segments[tilePos[0]].tiles[tilePos[1]]
            this.changeTexture({
              vertexIndicies: this.grid.tileIndexToVertexIndex[tilePos[1]],
              tile,
              hexIndex: i,
            })
          }
        }

        if (nextSelectedTokenId !== null) {
          store.dispatch(gameBoardTokenSelected({ tokenId: nextSelectedTokenId }))
        } else {
          store.dispatch(gameBoardTokenDeSelected({}))
        }

      }


    }
  }

  private onCameraSelectionMoved(change: THREE.Vector3) {
    console.log(`Move selection along ${change.x}, ${change.z}`)
  }

  private findIntersectedTokenId(x: number, y: number): IntersectedTile | null {
    if (this.grid) {
      // update the picking ray with the camera and pointer position
      this.raycaster.setFromCamera({x, y}, this.third.camera)
      const intersects = this.raycaster.intersectObject(this.grid.object)
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
          return {
            object: intersect.object as ExtendedObject3D,
            tokenId,
            tileIds: this.gameBoardState.tokenIdMap[tokenId],
          }
        }
      }
    }
    return null
  }

  private changeTexture(
      args: {
        vertexIndicies: number[],
        tile: Tile, hexIndex: number,
      }
  ) {
    if (this.textureHandler && this.grid) {
      const hover = args.tile.tokenId === this.hoverToken.tokenId
      const select = args.tile.tokenId === this.selectToken.tokenId

      const map = this.textureHandler.getTileUVMap(args.tile, args.hexIndex, hover, select)
      const uv = this.grid.geometry.getAttribute('uv')
      // console.debug(`Setting texture at ${args.vertexIndicies[0]} to ${map[0][0]}, ${map[0][1]} with ${hover} / ${select}`)
      for (let i = 0; i < 3; i++) {
        uv.setXY(args.vertexIndicies[i], map[i][0], map[i][1])
      }
      uv.needsUpdate = true
    }
  }

  stateUpdated() {
		// console.debug('Running state updated')
    // store.dispatch(animationsDone())
  }
}
