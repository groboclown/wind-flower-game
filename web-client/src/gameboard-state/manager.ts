// Manages the game board state

import { GameBoardRequests, GameBoardStatusHandler } from './events'


export interface GameBoardManager {
  registerHandler(handler: GameBoardStatusHandler): GameBoardRequests
  removeHandler(handler: GameBoardStatusHandler): void
}
