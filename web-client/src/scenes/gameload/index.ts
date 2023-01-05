// Load up the initial assets required by the preload.
import Phaser from 'phaser'
import { GAMEBOARD_SCENE_NAME, HUD_SCENE_NAME, GAME_LOAD_SCENE_NAME } from '../names'
import { getRestApiConnection, HostApi } from '../../server'
import {
  GAME_RUN_STATE__LOBBY,
  GAME_RUN_STATE__RUNNING,
  GAME_RUN_STATE__COMPLETED,
  GameTileParameter,
} from '../../server/structs'
import {} from '../../gameboard-state'
import {
  store,
  updateGameParameters,
  ServerGameParameter,
  GAME_LOBBY_STATE__NOT_CREATED,
  GAME_LOBBY_STATE__WAITING_FOR_PLAYERS,
  GAME_LOBBY_STATE__RUNNING,
  GAME_LOBBY_STATE__AFTER_PARTY,
} from '../../store'


// const EVENT__SERVER_LOAD_PROGRESS = "server load progress"
const EVENT__SERVER_LOAD_COMPLETED = "server load completed"


export default class GameLoadScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_LOAD_SCENE_NAME })
  }

  preload() {
    const self = this

    this.add.image(this.centerX(), this.centerY(), 'game-load/background')
    this.events.once(EVENT__SERVER_LOAD_COMPLETED, () => {
      console.log(`End game load screen`)
      self.cameras.main.fadeOut(1000, 0, 0, 0)
    })
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // Start the game.
      console.log(`Start game scenes`)
      this.scene.start(GAMEBOARD_SCENE_NAME)
      this.scene.start(HUD_SCENE_NAME)
    })
  }


  create() {
    const self = this

    // Load data from the server.  This might be loading
    //   a new game, or joining into an existing game (say, player was booted
    //   from the server or restarted their device).
    // TODO This will need a "cancel" button.

    const gameId = store.getState().gameLobby.gameId
    const api = new HostApi(getRestApiConnection())

    Promise.all([
      api
        .getGameParameters(gameId)
        .then((data) => {
          // The board size is associated with the gameboard data.

          store.dispatch(updateGameParameters({
            gameName: data.gameName,
            protected: data.protected,
            unlisted: data.unlisted,
            createdAt: data.createdAt,
            runState: convertRunStateValue(data.runState),
            minimumPlayerCount: data.minimumPlayerCount,
            maximumPlayerCount: data.maximumPlayerCount,
            parameters: convertServerParameters(data.parameters),
            currentPlayerTurn: data.currentPlayerTurn,
            currentBoardColumnMin: data.currentBoardColumnMin,
            currentBoardRowMin: data.currentBoardRowMin,
            currentBoardColumnMax: data.currentBoardColumnMax,
            currentBoardRowMax: data.currentBoardRowMax,
            lastTurn: null,
          }))
        })
      ])
      .then(() => {
        console.log(`Server load completed`)
        self.events.emit(EVENT__SERVER_LOAD_COMPLETED)
      })

      // TODO on error do error things.
  }

  private centerX(): number {
    return (0 + this.sys.game.canvas.width) / 2;
  }

  private centerY(): number {
    return (0 + this.sys.game.canvas.height) / 2;
  }
}


function convertRunStateValue(serverState: string): integer {
  switch (serverState) {
    case GAME_RUN_STATE__RUNNING:
      return GAME_LOBBY_STATE__RUNNING
    case GAME_RUN_STATE__LOBBY:
      return GAME_LOBBY_STATE__WAITING_FOR_PLAYERS
    case GAME_RUN_STATE__COMPLETED:
      return GAME_LOBBY_STATE__AFTER_PARTY
    default:
      return GAME_LOBBY_STATE__NOT_CREATED
  }
}

function convertServerParameters(params: GameTileParameter[]): ServerGameParameter[] {
  const ret: ServerGameParameter[] = []
  params.forEach((p) => {
    ret.push({
      name: p.name,
      l10n: p.name,
      key: p.parameterIndex,
    })
  })
  return ret
}
