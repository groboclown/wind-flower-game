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

export interface ServerTurnCompleted {
  completedPlayerTurn: number
  nextPlayerTurn: number

  // UTC datetime
  turnCompletedAt: string

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
    x: number
    y: number
    tiles: {
      x: number
      y: number
      z?: number
      category?: string
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
