// Client Gameplay User Interface State
import { createReducer } from '@reduxjs/toolkit'
import { gameBoardTokenSelected, gameBoardTokenDeSelected, gameBoardTokenHoverOver } from '../actions/interface'

export interface GameplayInterfaceState {
  selectedTokenId: number | null
  lastSelectedAt: number
  hoverOverTokenId: number | null
  lastHoverOverAt: number
}


function initialUserInterfaceState(): GameplayInterfaceState {
  const now = new Date().getTime()
  return {
    selectedTokenId: null,
    lastSelectedAt: now,
    hoverOverTokenId: null,
    lastHoverOverAt: now,
  }
}


export const gameplayInterfaceReducer = createReducer(
  initialUserInterfaceState(), (builder) => {
    builder
      .addCase(gameBoardTokenSelected, (state, action) => {
        if (state.lastSelectedAt < action.payload.when) {
          state.lastSelectedAt = action.payload.when
          state.selectedTokenId = action.payload.tokenId
        }
      })
      .addCase(gameBoardTokenDeSelected, (state, action) => {
        if (state.lastSelectedAt < action.payload.when) {
          state.lastSelectedAt = action.payload.when
          state.selectedTokenId = null
        }
      })
      .addCase(gameBoardTokenHoverOver, (state, action) => {
        if (state.lastHoverOverAt < action.payload.when) {
          state.lastHoverOverAt = action.payload.when
          state.hoverOverTokenId = action.payload.tokenId
        }
      })
  }
)
