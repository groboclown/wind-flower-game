// Client Gameplay User Interface Actions
import { createAction } from '@reduxjs/toolkit'

export interface GameBoardTokenSelected {
  tokenId: number
  when: number
}

export interface GameBoardTokenSelectedPartial {
  tokenId: number
}

export const gameBoardTokenSelected = createAction(
  'GameplayInterface/tokenSelected', function prepare(info: GameBoardTokenSelectedPartial) {
    return {
      payload: {
        when: new Date().getTime(),
        ...info
      } as GameBoardTokenSelected,
    }
  }
)


export interface GameBoardTokenDeSelectedPartial {
}


export interface GameBoardTokenDeSelected {
  when: number
}


export const gameBoardTokenDeSelected = createAction(
  'GameplayInterface/tokenDeSelected', function prepare(info: GameBoardTokenDeSelectedPartial) {
    return {
      payload: {
        when: new Date().getTime(),
        ...info
      } as GameBoardTokenDeSelected
    }
  }
)


export interface GameBoardTokenHoverOverPartial {
  tokenId: number | null
}

export interface GameBoardTokenHoverOver {
  tokenId: number | null
  when: number
}

export const gameBoardTokenHoverOver = createAction(
  'GameplayInterface/tokenHoverOver', function prepare(info: GameBoardTokenHoverOverPartial) {
    return {
      payload: {
        when: new Date().getTime(),
        ...info
      } as GameBoardTokenHoverOver,
    }
  }
)
