// Translation of server API actions into server store actions.
// These are used by multiple states.
// TODO this should be merged with the server/api.ts
import { createAction } from '@reduxjs/toolkit'


// ServerPerformanceInformation description of limits for the server API.
export interface ServerPerformanceInformation {
  maximumBoardSegmentWidth: number
  maximumBoardSegmentHeight: number
  maximumPlayerCount: number
}


export const updateServerPerformanceInformation = createAction(
  'ServerPerformanceInformation/update', function prepare(info: ServerPerformanceInformation) {
    return { payload: info }
  },
)


export interface ServerPlayerInfo {
  humanName: string
  role: string
  playerIndex: integer
  tileTheme: string
  state: string
}


export interface ServerGameParameter {
  // name Parameter id, for graphical display and internal server handling
  name: string

  // l10n Localized name, for human reading
  //   TODO implies an extra client parameter or account information for localization.
  l10n: string

  // key Integer key for quick lookup and short abbreviation
  key: integer

  // could also be things like color, icon, description
}

// GameLobbyCreated response from the server on a valid create game lobby request.
// Can also come from joining an existing game or lobby.
export interface GameLobbyCreated {
  gameName: string
  gameId: string
  players: ServerPlayerInfo[]
  clientPlayerIndex: integer
  gameLobbyState: integer
  maximumPlayerCount: integer
  maximumTurnCount: integer
  parameters: ServerGameParameter[]
}


export const createdGameLobby = createAction(
  'GameLobby/create', function prepare(info: GameLobbyCreated) {
    return { payload: info }
  },
)


export interface GameLobbyPlayersUpdated {
  playersAdded?: ServerPlayerInfo[]

  playersRemoved?: {
    humanName: string
  }[]

  playersChanged?: {
    playerIndex: integer
    humanName?: string
    tileTheme?: string
    state?: string
  }[]
}


export const gameLobbyPlayersUpdated = createAction(
  'GameLobby/players-update', function prepare(info: GameLobbyPlayersUpdated) {
    return { payload: info }
  }
)


export interface GameLobbyStateChange {
  newState: integer
}


export const gameLobbyStateChanged = createAction(
  'GameLobby/server-state-change', function prepare(info: GameLobbyStateChange) {
    return { payload: info }
  }
)


export interface GameParametersStateLoad {
  gameName: string

  // protected true if there's an extra secret preventing random people from joining
  //   This is different than a private game.
  protected: boolean

  // unlisted true if the game isn't listed by the server
  unlisted: boolean

  // UTC datetime
  createdAt: integer

  runState: integer

  // For lobby mode, these values may change.
  // Once the game starts, these are unmodifiable.
  minimumPlayerCount: integer
  maximumPlayerCount: integer
  parameters: ServerGameParameter[]

  // currentPlayerTurn only has meaning for RUNNING state.
  //   This is a tad redundand from lastTurn.nextPlayerTurn,
  //   but it's important for the first turn, where 'lastTurn' is null.
  currentPlayerTurn: integer

  currentBoardColumnMin: integer
  currentBoardRowMin: integer
  currentBoardColumnMax: integer
  currentBoardRowMax: integer

  lastTurn: ServerTurnCompleted | null
}


export const updateGameParameters = createAction(
  'GameLobby/server-parameters-change', function prepare(info: GameParametersStateLoad) {
    return { payload: info }
  }
)


export interface ServerTurnCompleted {
  completedPlayerTurn: number
  nextPlayerTurn: number

  // UTC datetime
  turnCompletedAt: integer

  // Which token was played?
  tokenPlayed: {
    x: number
    y: number
    z: number
    category: string
    parameters: {
      parameterIndex: number
      quantity: number
      x: number
      y: number
    }[]
  }

  // All segments that had altered tiles.
  //   Only the bits of the tiles that changed, and only
  //   the changed tiles are here.
  //   This includes the played token.
  segmentChanges: {
    // The segment index
    x: number
    y: number

    tiles: {
      x: number
      y: number
      z?: number
      category?: string
      tokenId?: number
      parameters: {
        parameterIndex: number
        quantity: number
        x: number
        y: number
      }[]
    }[]
  }[]

  // If the next player is the client, then the tokeNDrawn is included.
  tokenDrawn?: {
    name: string
    category: string
    parameters: {
      parameterIndex: number
      quantity: number
    }[]
  }
}

export const updateServerTurn = createAction(
  'ServerTurn/update', function prepare(info: ServerTurnCompleted) {
    return { payload: info }
  }
)


// AccountCreated the server created the requested account.
export interface AccountCreated {
  loginId: string
  publicKey: string
  privateKey: string
}

export const createAccount = createAction(
  'Account/created', function prepare(info: AccountCreated) {
    return { payload: info }
  }
)
