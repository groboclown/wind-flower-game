// Information for the game specific to the client player.
import { createReducer } from '@reduxjs/toolkit'
import { updateServerTurn, createAccount, updateServerPerformanceInformation } from '../actions/api'
import { loadedClientAccount, loadedServer } from '../actions/clientdb'
import { updatedUserPreferences } from '../actions/ui-settings'
import { Token } from './turn'

// This will probably need to change around some, to
//   better separate user settings from the player state.

export interface User {
  humanName: string
  loginId: string
  privateKey: string
  publicKey: string
  locale: string
  localTz: string
  exists: boolean
  defaultGameName: string
  defaultTileTheme: string
  visibleWidth: integer
  visibleHeight: integer
}


export interface Server {
  serverName: string
  publicKey: string
  maximumBoardSegmentWidth: integer
  maximumBoardSegmentHeight: integer
  maximumPlayerCount: integer
}


export interface ClientPlayerState {
  // All tokens in the player's hand.
  hand: Token[]

  user: User
  server: Server
}


function initialClientPlayerState(): ClientPlayerState {
  return {
    hand: [],
    user: {
      humanName: '',
      loginId: '',
      privateKey: '',
      publicKey: '',
      locale: '',
      localTz: 'UTC',
      exists: false,
      defaultGameName: '',
      defaultTileTheme: '',
      visibleWidth: 30,
      visibleHeight: 30,

    },
    server: {
      serverName: '',
      publicKey: '',
      maximumBoardSegmentWidth: 0,
      maximumBoardSegmentHeight: 0,
      maximumPlayerCount: 0,
    },
  }
}


export const clientPlayerReducer = createReducer(
  initialClientPlayerState(), (builder) => {
    builder
      .addCase(updateServerTurn, (state, action) => {
        if (action.payload.tokenDrawn) {
          state.hand.push({
            name: action.payload.tokenDrawn.name,
            category: action.payload.tokenDrawn.category,
            parameters: [...action.payload.tokenDrawn.parameters],
          })
        }
      })
      .addCase(createAccount, (state, action) => {
        state.user.loginId = action.payload.loginId
        state.user.privateKey = action.payload.privateKey
        state.user.publicKey = action.payload.publicKey
      })
      .addCase(loadedClientAccount, (state, action) => {
        state.user.humanName = action.payload.humanName
        state.user.loginId = action.payload.loginId
        state.user.privateKey = action.payload.privateKey
        state.user.publicKey = action.payload.publicKey
        state.user.locale = action.payload.locale
        state.user.localTz = action.payload.localTz
        state.user.exists = action.payload.exists
      })
      .addCase(loadedServer, (state, action) => {
        state.server.publicKey = action.payload.publicKey
        state.server.serverName = action.payload.serverName
      })
      .addCase(updateServerPerformanceInformation, (state, action) => {
        state.server.maximumBoardSegmentWidth = action.payload.maximumBoardSegmentWidth
        state.server.maximumBoardSegmentHeight = action.payload.maximumBoardSegmentHeight
        state.server.maximumPlayerCount = action.payload.maximumPlayerCount
      })
      .addCase(updatedUserPreferences, (state, actions) => {
        state.user.humanName = actions.payload.humanName
        state.user.defaultGameName = actions.payload.gameName
        state.user.defaultTileTheme = actions.payload.tileTheme
        state.user.visibleWidth = actions.payload.visibleWidth
        state.user.visibleHeight = actions.payload.visibleHeight
      })
  },
)
