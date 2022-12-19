// The Game Board State
// The game board is the one piece of data kept outside the redux store,
//   because it is swapped around to conserve memory, and there are requests
//   to fetch more.

export * from './state'
export * from './events'
export * from './manager'


import { HostApi } from '../server/api'
import { TileParameterType } from './state'
import { GameBoardManager } from './manager'
import { GameBoardManagerImpl } from './impl'


export function createGameBoardManager(
  hostApi: HostApi,
  gameId: string,
  segmentWidth: integer,
  segmentHeight: integer,
  parameterTypes: TileParameterType[],
): GameBoardManager {
  return new GameBoardManagerImpl(
    hostApi, gameId, segmentWidth, segmentHeight, parameterTypes,
  )
}
