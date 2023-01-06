// The game lobby; where players mingle and wait for a game to start.
// It's also the general game state itself when the game is running.
import { createReducer } from '@reduxjs/toolkit'
import { loadedClientAccount } from '../actions/clientdb'
import {
  createdGameLobby,
  gameLobbyPlayersUpdated,
  gameLobbyStateChanged,
  updateGameParameters,
} from '../actions/api'


export const GAME_LOBBY_STATE__NOT_CREATED = -1
export const GAME_LOBBY_STATE__WAITING_FOR_PLAYERS = 0
export const GAME_LOBBY_STATE__RUNNING = 1
export const GAME_LOBBY_STATE__AFTER_PARTY = 2


// One of the players in the lobby or playing the game.
export interface Player {
  // How to reference the player in the UI.
  humanName: string

  // The role of the player.  Generally, this is "host", "invited", or "guest"
  role: string

  // An index, for some lookup references.
  playerIndex: integer

  // General color palatte of the player's tiles.
  tileTheme: string

  // General state for the player.  The meaning changes
  //   on the game state, too.  It can be "ready to play",
  //   "afk", or other things.
  state: string

  // Could also add things like icon, player color, subtitle or MOTD, etc.
}


// A parameter for the game.  These are either "on" (present) or "off" (not present).
export interface GameParameter {
  // name Parameter id, for graphical display
  name: string

  // l10n Localized name, for human reading
  l10n: string

  // key Integer key for quick lookup and short abbreviation
  key: integer
}


// GameMode created when the game is created.
export interface GameMode {
  // Maximum allowed number of players to have in the game.
  maximumPlayerCount: integer | null

  // Maximum number of turns to allow.
  maximumTurnCount: integer | null

  // the tile parameters to use.
  parameters: GameParameter[]
}


// RunningState if a game is actively running, this contains high level information
//   This may be updated on the server as the game runs, but this state is only updated
//   when the server values are explicitly queried.
export interface RunningState {
  // currentPlayerIndexTurn whose turn is it?
  currentPlayerIndexTurn: integer

  // currentTurnStartedAt cannot store Date instances in a redux store, so this is the time.
  currentTurnStartedAt: integer

  boardMinColumn: integer
  boardMinRow: integer
  boardMaxColumn: integer
  boardMaxRow: integer

  // TODO this should probably be enhanced in the future
  playerScores: number[]
}


// The active players in the game.
export interface GameLobbyState {
  gameName: string
  gameId: string
  players: Player[]

  // Which player the client player is assigned in the player list.
  clientPlayerIndex: integer

  // lobbyState One of GAME_LOBY_STATE__*
  gameLobbyState: integer

  // gameMode information about the game setup
  // Declared at creation time.  Might be changable waiting for players.
  gameMode: GameMode

  // runningState set if the game state is RUNNING
  runningState: RunningState | null
}


function initialGameLobbyState(): GameLobbyState {
  return {
    gameName: 'My Game',

    // TODO generate a random string.
    gameId: 'a1',

    players: [],
    clientPlayerIndex: -1,
    gameLobbyState: GAME_LOBBY_STATE__NOT_CREATED,
    gameMode: {
      maximumPlayerCount: null,
      maximumTurnCount: null,
      parameters: [],
    },
    runningState: null,
  }
}


export const gameLobbyReducer = createReducer(
  initialGameLobbyState(), (builder) => {
    builder
      .addCase(loadedClientAccount, (state, action) => {
        // FIXME PLACEHOLDER - this is wrong
        state.gameName = action.payload.humanName
      })
      .addCase(createdGameLobby, (state, action) => {
        state.gameName = action.payload.gameName
        state.gameId = action.payload.gameId
        state.gameLobbyState = action.payload.gameLobbyState
        state.players = []
        action.payload.players.forEach((player) => {
          state.players.push({...player})
        })
        state.gameMode.maximumPlayerCount = action.payload.maximumPlayerCount
        state.gameMode.maximumTurnCount = action.payload.maximumTurnCount
        state.gameMode.parameters = []
        action.payload.parameters.forEach((param) => {
          state.gameMode.parameters.push({...param})
        })

        // TODO is this one derived?
        state.clientPlayerIndex = action.payload.clientPlayerIndex

        // FIXME ADD REMAINDER
      })
      .addCase(gameLobbyPlayersUpdated, (state, action) => {
        action.payload.playersAdded?.forEach((player) => {
          state.players.push({
            ...player
          })
        })
        // FIXME add remaining actions - remove + change
      })
      .addCase(gameLobbyStateChanged, (state, action) => {
        state.gameLobbyState = action.payload.newState
      })
      .addCase(updateGameParameters, (state, action) => {
        state.gameName = action.payload.gameName
        state.gameMode.parameters = action.payload.parameters
        if (action.payload.runState === GAME_LOBBY_STATE__RUNNING) {
          state.runningState = {
            boardMinColumn: action.payload.currentBoardColumnMin,
            boardMinRow: action.payload.currentBoardRowMin,
            boardMaxColumn: action.payload.currentBoardColumnMax,
            boardMaxRow: action.payload.currentBoardRowMax,
            currentPlayerIndexTurn: action.payload.currentPlayerTurn,
            currentTurnStartedAt:
              action.payload.lastTurn === null
                ? Date.now()
                : action.payload.lastTurn.turnCompletedAt,

            // TODO fill in the player scores
            playerScores: [],
          }
        } else {
          state.runningState = null
        }

        // TODO update player list
      })
  },
)
