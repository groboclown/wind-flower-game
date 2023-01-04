// Structures in the Rest API


// Account Server generated information about a created account.
export interface Account {
  privateKey: string
  publicKey: string
  accountId: string
}


// SegmentTile information about a single segment tile.
//   Keys are condensed for smaller packet sizes.
export interface SegmentTile {
  // x position of the tile within the whole game board.
  x: integer

  // y position of the tile within the whole game board.
  y: integer

  // h height of the tile
  h: number

  // c category of the tile
  c: string

  // t token ID of the tile; 6 tiles share this token ID.
  t: integer

  // p list of parameter index / quantity for the tile.
  p: {i: integer, q: number}[]
}


export interface SegmentChange {
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
}


export interface ServerTurnCompleted {
  completedPlayerTurn: integer
  nextPlayerTurn: integer

  // UTC datetime
  turnCompletedAt: string

  // Which token was played?
  tokenPlayed: {
    x: integer
    y: integer
    z: number
    category: string
    parameters: {
      parameterIndex: integer
      quantity: integer
    }[]
  }

  // All segments that had altered tiles.
  //   Only the bits of the tiles that changed, and only
  //   the changed tiles are here.
  //   This includes the played token.
  segmentChanges: SegmentChange[]

  // If the next player is the client, then the tokeNDrawn is included.
  tokenDrawn?: {
    name: string
    category: string
    parameters: {
      parameterIndex: integer
      // Note: floating point numbers are returned as strings by the server
      quantity: number
    }[]
  }
}


// ServerParameters server limitations
export interface ServerParameters {
  // Possible future enhancements:
  //   Game Modes Supported

  //   Maximum number of players in a game

  // maximumTileWidth Maximum count of tiles along the x-axis to fetch in a single request.
  maximumTileWidth: integer

  // maximumTileHeight Maximum count of tiles along the y-axis to fetch in a single request.
  maximumTileHeight: integer
}


// ActiveGamePlayer player in a game.
export interface ActiveGamePlayer {
  playerIndex: integer
  publicName: string
  // TODO color, icon, etc
}


// GameParameters information about a running game
//   or a pending game in a game lobby.
export interface GameParameters {
  currentBoardWidth: integer
  currentBoardHeight: integer

  // lobby, running, complete
  runState: string

  currentPlayerTurn: integer

  players: ActiveGamePlayer[]
}
