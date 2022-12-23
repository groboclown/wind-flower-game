// The game lobby; where players mingle and wait for a game to start.
// It's also the general game state itself when the game is running.
import { createReducer } from '@reduxjs/toolkit'
import { loadedClientAccount } from '../actions/clientdb'
import {
  createdGameLobby,
  gameLobbyPlayersUpdated,
  gameLobbyStateChanged,
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


// The active players in the game.
export interface GameLobbyState {
  gameName: string
  gameId: string
  players: Player[]

  // Which player the client player is assigned in the player list.
  clientPlayerIndex: integer

  // The lobby state.
  gameLobbyState: integer

  // The game mode.
  // Declared at creation time.  Might be changable waiting for players.
  gameMode: GameMode
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
  },
)
