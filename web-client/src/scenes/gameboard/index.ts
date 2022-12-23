// The Primary Game.  Viewing the Game Board.
import { Unsubscribe } from 'redux'
import { Scene3D } from '@enable3d/phaser-extension'
import { THREE } from 'enable3d'
import { Grid3d, IntersectedTokenTile, createIntersectedTokenTile } from './grid'
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
  gameBoardTokenSelected,
  gameBoardTokenDeSelected,
  gameBoardTokenHoverOver,
} from '../../store'
import {
  TileParameterType,
  GameBoardManager,
  createGameBoardManager,
} from '../../gameboard-state'
import { getRestApiConnection, HostApi } from '../../server'


export default class GameBoardScene extends Scene3D {
  private grid3d: Grid3d | null
	private controls: CameraInput | null
  private textureHandler: TextureHandler | null
  private gameBoardManager: GameBoardManager | null
  private storeListener: Unsubscribe | null

  private hoverToken: IntersectedTokenTile
  private selectToken: IntersectedTokenTile
  private nextHoverToken: IntersectedTokenTile
  private nextSelectToken: IntersectedTokenTile


  constructor() {
    super({ key: GAMEBOARD_SCENE_NAME })
		this.grid3d = null
		this.controls = null
    this.textureHandler = null
    this.gameBoardManager = null
    this.storeListener = null

    this.hoverToken = createIntersectedTokenTile()
    this.selectToken = createIntersectedTokenTile()
    this.nextHoverToken = createIntersectedTokenTile()
    this.nextSelectToken = createIntersectedTokenTile()
  }


  init() {
    this.accessThirdDimension({
      antialias: false,
      renderer: new THREE.WebGL1Renderer({
        antialias: false,
        powerPreference: "high-performance",
      })
    })
  }


  // preload runs before create.
  preload() {

  }


  create(): void {
    const self = this
    const state = store.getState()

    // The game lobby should set up the parameters.
    const gameModeParameters: TileParameterType[] = []
    state.gameLobby.gameMode.parameters.forEach((param) => {
      gameModeParameters.push({...param})
    })

    this.gameBoardManager = createGameBoardManager(
      // TODO use a real server interface here.
      //   At the very least, use the 'single player' server.
      new HostApi(getRestApiConnection()),

      // The game lobby should set the game ID.
      state.gameLobby.gameId,

      // The main menu connecting to a game server should load the server parameters.
      state.clientPlayer.server.maximumBoardSegmentWidth,
      state.clientPlayer.server.maximumBoardSegmentHeight,

      gameModeParameters,
    )

    const defaultLookAt = new THREE.Vector3(0, 0, 0)
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

    // Grid
    this.textureHandler = new TextureHandler(this.cache.json.get('mesh-uv-map'))
    const meshTexture = getCachedTexture(this, 'mesh-texture')
    meshTexture.mapping = THREE.UVMapping

    // for (let i = 0; i < this.gameBoardState.segments.length; i++) {
    //   console.log(`Segment ${i} sized ${this.gameBoardState.segments[i].tiles.length}`)
    // }
		this.grid3d = new Grid3d(
      this.gameBoardManager,
      meshTexture,
      this.textureHandler,
      state.clientPlayer.user.visibleWidth,
      state.clientPlayer.user.visibleHeight,

      // TODO Initial player position on the board should come from the server
      //   on game setup.
      0, 0
    )

    this.grid3d.getObjects().forEach((object) => {
      this.third.scene.add(object)
      this.third.physics.add.existing(object)
      object.body.setCollisionFlags(1)  // STATIC
    })

    // Trigger initial grid loading
    this.grid3d.updateGridAtTarget(defaultLookAt, true)

    // Start listening for changes
    this.storeListener = store.subscribe(() => this.stateUpdated())
  }


  update() {
    this.controls?.onUpdate()
	}

  // Remove the state listener when the scene is no longer active.
  shutdown() {
    if (this.storeListener !== null) {
      this.storeListener()
      this.storeListener = null
    }
  }


  private onCameraPointerMoved(x: number, y: number) {
    // Calculate pointer position in normalized device coordinates
	  //   (-1 to +1) for both components

    // console.log(`last mouse position set at (${x}, ${y})`)
    if (this.grid3d) {
      this.grid3d.populateIntersectedTile(
        this.third.camera, x, y, this.nextHoverToken)
      if (this.hoverToken.tokenId !== this.nextHoverToken.tokenId) {
        // They point to different things.  Could be hovering over
        //   nothing, or was hovering over nothing.
        //   The update calls will work with a nothing hover.
        this.grid3d.updateTileTexture(
          this.hoverToken,
          { hoverOver: false, selected: this.hoverToken.tokenId === this.selectToken.tokenId },
        )
        this.grid3d.updateTileTexture(
          this.nextHoverToken,
          { hoverOver: true, selected: this.nextHoverToken.tokenId === this.selectToken.tokenId },
        )

        // Swap the next/current.
        const tmp = this.hoverToken
        this.hoverToken = this.nextHoverToken
        this.nextHoverToken = tmp

        // Tell the rest of the game about the hover.
        store.dispatch(gameBoardTokenHoverOver({ tokenId: this.hoverToken.tokenId }))
      }
    }
  }

  private onCameraPointerSelected(x: number, y: number) {
    // console.log(`Clicked on ${x}, ${y}`)
    if (this.grid3d) {
      this.grid3d.populateIntersectedTile(
        this.third.camera, x, y, this.nextSelectToken)
      if (this.selectToken.tokenId !== this.nextSelectToken.tokenId) {
        console.log(`Selection changed from ${this.selectToken.tokenId} to ${this.nextSelectToken.tokenId}`)
        // Change in the selection.  Could be selecting nothing,
        //   or could be selecting from nothing.
        this.grid3d.updateTileTexture(
          this.selectToken,
          { hoverOver: this.selectToken.tokenId === this.hoverToken.tokenId, selected: false },
        )
        this.grid3d.updateTileTexture(
          this.nextSelectToken,
          { hoverOver: this.nextSelectToken.tokenId === this.hoverToken.tokenId, selected: true },
        )

        // Swap the next/current.
        const tmp = this.selectToken
        this.selectToken = this.nextSelectToken
        this.nextSelectToken = tmp

        // Tell the rest of the game about the selection.
        if (this.selectToken.tokenId !== null) {
          store.dispatch(gameBoardTokenSelected({ tokenId: this.selectToken.tokenId }))
        } else {
          store.dispatch(gameBoardTokenDeSelected({}))
        }
      }
    }
  }

  private onCameraSelectionMoved(change: THREE.Vector3) {
    console.log(`Move selection along ${change.x}, ${change.z}`)
  }

  stateUpdated() {
		// console.debug('Running state updated')
    // store.dispatch(animationsDone())
  }
}
