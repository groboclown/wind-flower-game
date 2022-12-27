// Game Options and Server Connection and Other Initial Stuff
import Phaser from 'phaser'
import { Unsubscribe } from 'redux'
import { GAME_LOAD_SCENE_NAME, MAINMENU_SCENE_NAME } from '../names'
import { initializeSinglePlayerServer, getRestApiConnection } from '../../server/connection'
import { TestDataGeneratorApiConnection, MAX_RETURNED_WIDTH, MAX_RETURNED_HEIGHT } from './test-data'
import {
  createdGameLobby,
  gameLobbyStateChanged,
  updateServerPerformanceInformation,
  GAME_LOBBY_STATE__WAITING_FOR_PLAYERS,
  GAME_LOBBY_STATE__RUNNING,
  store,
} from '../../store'
import { AllServers } from '../../assets'


const EVENT__START_GAME = "start game"


export default class MainMenuScene extends Phaser.Scene {
  private storeListener: Unsubscribe | null

  constructor() {
    super({ key: MAINMENU_SCENE_NAME })
    this.storeListener = null
  }


  preload() {
    const self = this

    this.add.image(this.centerX(), this.centerY(), 'main-menu/background')
    this.events.once(EVENT__START_GAME, () => {
      self.cameras.main.fadeOut(1000, 0, 0, 0)
    })
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(GAME_LOAD_SCENE_NAME)
    })
  }

  create() {
    if (this.storeListener !== null) {
      this.storeListener()
    }
    this.storeListener = store.subscribe(() => {
      if (store.getState().gameLobby.gameLobbyState === GAME_LOBBY_STATE__RUNNING) {
        // Start up the game.
        this.events.emit(EVENT__START_GAME)
      }
    })


    // Mock up what the main menu game start is supposed to do.

    // - choose a server.
    initializeSinglePlayerServer(new TestDataGeneratorApiConnection('game1'))
    const serverListInfo = this.cache.json.get('server-info') as AllServers
    if (serverListInfo.servers.length > 0) {
      getRestApiConnection().setServerPublicKey(atob(serverListInfo.servers[0].publicKeyBase64))
    }

    // - Get information on the server.
    //   This should be done via the server API during the game lobby.
    store.dispatch(updateServerPerformanceInformation({
      maximumBoardSegmentWidth: MAX_RETURNED_WIDTH,
      maximumBoardSegmentHeight: MAX_RETURNED_HEIGHT,
      maximumPlayerCount: 1,
    }))

    // - Create a new game lobby
    //   Should be done via server API
    store.dispatch(createdGameLobby({
      gameId: 'game1',
      gameName: 'Test',
      players: [],
      clientPlayerIndex: 0,
      gameLobbyState: GAME_LOBBY_STATE__WAITING_FOR_PLAYERS,
      maximumPlayerCount: 1,
      maximumTurnCount: 10000,
      parameters: [],
    }))

    // - Start the game.
    //   Should be done by the server state change poll or web sockets.
    store.dispatch(gameLobbyStateChanged({
      newState: GAME_LOBBY_STATE__RUNNING,
    }))
  }

  // Remove the state listener when the scene is no longer active.
  shutdown() {
    if (this.storeListener !== null) {
      this.storeListener()
      this.storeListener = null
    }
  }

  private centerX(): number {
    return (0 + this.sys.game.canvas.width) / 2;
  }

  private centerY(): number {
    return (0 + this.sys.game.canvas.height) / 2;
  }
}
