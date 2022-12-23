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


export default class MainMenuScene extends Phaser.Scene {
  private storeListener: Unsubscribe | null

  constructor() {
    super({ key: MAINMENU_SCENE_NAME })
    this.storeListener = null
  }


  create() {
    if (this.storeListener !== null) {
      this.storeListener()
    }
    this.storeListener = store.subscribe(() => {
      if (store.getState().gameLobby.gameLobbyState === GAME_LOBBY_STATE__RUNNING) {
        // Start up the game.
        this.scene.start(GAME_LOAD_SCENE_NAME)
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
}
