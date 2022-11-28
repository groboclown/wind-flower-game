// The game lobby; where players mingle and wait for a game to start.
import { createReducer } from '@reduxjs/toolkit'
import { loadedClientAccount } from '../actions/clientdb'

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
  playerIndex: number

  // General color palatte of the player's tiles.
  tileTheme: string

  // General state for the player.  The meaning changes
  //   on the game state, too.  It can be "ready to play",
  //   "afk", or other things.
  state: string
}


// A parameter for the game.  These are either "on" (present) or "off" (not present).
export interface GameParameter {
  name: string
}


// GameMode created when the game is created.
export interface GameMode {
  // Total number of players to have in the game.
  totalPlayerCount: number

  // Maximum number of turns to allow.
  maximumTurnCount: number | null

  // the tile parameters to use.
  parameters: GameParameter[]
}


// The active players in the game.
export interface GameLobbyState {
  gameName: string
  gameId: string
  players: Player[]

  // Which player the client player is assigned in the player list.
  clientPlayerIndex: number

  // The lobby state.
  gameLobbyState: number

  // The game mode.
  // Declared at creation time.  Might be changable waiting for players.
  gameMode: GameMode
}


function initialGameLobbyState(): GameLobbyState {
  return {
    gameName: "My Game",

    // TODO generate a random string.
    gameId: "a1",

    players: [],
    clientPlayerIndex: -1,
    gameLobbyState: GAME_LOBBY_STATE__NOT_CREATED,
    gameMode: {
      totalPlayerCount: -1,
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
  },
)
