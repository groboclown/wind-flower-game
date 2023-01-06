// Game Options and Server Connection and Other Initial Stuff
import Phaser from 'phaser'
import { Unsubscribe } from 'redux'
import { GAME_LOAD_SCENE_NAME, MAINMENU_SCENE_NAME } from '../names'
import { initializeSinglePlayerServer, getRestApiConnection } from '../../server/connection'
import { createMassDataMockServer } from './test-data'
import {
  createdGameLobby,
  gameLobbyStateChanged,
  updateServerPerformanceInformation,
  GAME_LOBBY_STATE__WAITING_FOR_PLAYERS,
  GAME_LOBBY_STATE__RUNNING,
  store,
} from '../../store'
import { AllServers } from '../../assets'
import { HostApi } from '../../server'


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
    Promise.resolve(null).then(async () => {
      // - choose a server.
      //   This should be its own set of scenes.
      const serverSetup = await createMassDataMockServer('https://test.server.name')
      initializeSinglePlayerServer(serverSetup.connection)
      const serverConnection = getRestApiConnection()

      const serverListInfo = this.cache.json.get('server-info') as AllServers
      if (serverListInfo.servers.length > 0) {
        // serverConnection.setServerPublicKey(atob(serverListInfo.servers[0].publicKeyBase64))
        serverConnection.setServerPublicKey(serverSetup.serverPublicKey)
      }
      const hostApi = new HostApi(serverConnection)
      // Should be using an existing account, but...
      const createdAccount = await hostApi.createAccount()
      await serverConnection.setAccountConnectionInformation(
        createdAccount.accountId, createdAccount.privateKey, ''
      )

      // - Get information on the server.
      const serverInfo = await hostApi.getServerParameters()
      store.dispatch(updateServerPerformanceInformation({
        maximumBoardSegmentWidth: serverInfo.maximumTileWidth,
        maximumBoardSegmentHeight: serverInfo.maximumTileHeight,
        maximumPlayerCount: serverInfo.maximumPlayerCount,
      }))

      // - Create a new game lobby
      //   This should be a separate scene, for the pre-game stuff.
      //   Stuff like, list existing games, join an existing game,
      //   join an unlisted game, create a game.
      //   That will then put to yet another scene, for the game lobby
      //   (if it's in the 'lobby' state).
      const gameLobbyId = await hostApi.startGameLobby('Test Game', 2)

      // - After joining a game lobby, even if it was just created, immediately query it.
      const gameLobby = await hostApi.getGameParameters(gameLobbyId.gameId)

      // Currently, always set the game state to waiting on players.
      //   If the state is actually in-progress, then immediately change
      //   the state with store.dispatch(gameLobbyStateChanged(...))
      store.dispatch(createdGameLobby({
        gameId: gameLobbyId.gameId,
        gameName: gameLobby.gameName,
        players: [],  // TODO replace
        clientPlayerIndex: 0,  // TODO replace
        gameLobbyState: GAME_LOBBY_STATE__WAITING_FOR_PLAYERS,  // TODO replace
        maximumPlayerCount: gameLobby.maximumPlayerCount,
        maximumTurnCount: gameLobby.maximumTurnCount,
        parameters: [],  // TODO replace
      }))

      // - Start the game.
      //   Should be done by the server state change poll or web sockets.
      store.dispatch(gameLobbyStateChanged({
        newState: GAME_LOBBY_STATE__RUNNING,
      }))
    })
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
