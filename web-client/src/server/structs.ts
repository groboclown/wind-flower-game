// Structures in the Rest API
// On the server, "x" is the tile column, "y" is the tile row, and "h" is the tile height.
// The client sees the world differently.
// Additionally, the server encodes:
//   dates as UTC formatted strings
//     - however, the json parsing handles conversion to a Date.
//   numerics (floating point numbers) as strings
//     - however, the json parsing handles numerics and strings conversions equally.


// NewAccount Server generated information about a created account.
export interface NewAccount {
  privateKey: string
  publicKey: string
  accountId: string
}


// SegmentTile information about a single segment tile.
//   Keys are condensed for smaller packet sizes, since
//   this data structure is sent in large numbers.
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


// SegmentTileCollection collection of tiles within a requested area
export interface SegmentTileCollection {
  sizeX: integer
  sizeY: integer
  segments: SegmentTile[]
}


export interface ChangedTile {
  x: integer
  y: integer
  h?: number
  parameters: TokenPlayedParameter[]

  // category can change if the parameters change enough to render it differently
  category?: string

  // tokenId can never change
}


export interface TokenPlayedParameter {
  parameterIndex: integer
  quantity: number
  direction: integer
}


export interface TokenPlayed {
  x: integer
  y: integer
  h: string
  category: string
  parameters: TokenPlayedParameter[]
}


export interface DrawnToken {
  name: string

  // Each tile in the token has a different set of parameters and categories.

  category00: string
  parameters00: TokenPlayedParameter[]

  category01: string
  parameters01: TokenPlayedParameter[]

  category02: string
  parameters02: TokenPlayedParameter[]

  category10: string
  parameters10: TokenPlayedParameter[]

  category11: string
  parameters11: TokenPlayedParameter[]

  category12: string
  parameters12: TokenPlayedParameter[]
}


export interface ServerTurnCompleted {
  completedPlayerTurn: integer
  nextPlayerTurn: integer

  // turnCompletedAt UTC datetime
  turnCompletedAt: Date

  // Which token was played?
  tokenPlayed: TokenPlayed

  // All altered tiles.
  //   Only the bits of the tiles that changed, and only
  //   the changed tiles are here.
  //   This includes the played token and flow updates.
  tileChanges: ChangedTile[]

  // If the next player is the client, then the tokeNDrawn is included.
  tokenDrawn?: DrawnToken
}


// ServerParameters server limitations
export interface ServerParameters {
  // Possible future enhancements:
  //   Game Modes Supported

  // maximumTileWidth Maximum count of tiles along the x-axis to fetch in a single request.
  maximumTileWidth: integer

  // maximumTileHeight Maximum count of tiles along the y-axis to fetch in a single request.
  maximumTileHeight: integer

  // maximumPlayerCount maximum number of players in a single game or game lobby.
  maximumPlayerCount: integer
}


// ActiveGamePlayer player in a game.
export interface ActiveGamePlayer {
  playerIndex: integer
  publicName: string

  // lastConnectedTime UTC datetime
  //   Might be too much information to make public, but for other players, it's handy.
  lastConnectedTime?: Date

  // state custom state information; for the lobby, this includes "ready" state.
  state: string

  // TODO color, icon, etc

  // score not set if game hasn't started
  score?: number
}


// GameTileParameter a flow type for a tile
export interface GameTileParameter {
  parameterIndex: integer
  name: string

  // TODO color, icon, etc
}


export const GAME_RUN_STATE__LOBBY = "lobby"
export const GAME_RUN_STATE__RUNNING = "running"
export const GAME_RUN_STATE__COMPLETED = "completed"


// GameParameters information about a running game
//   or a pending game in a game lobby.
export interface GameParameters {
  gameName: string

  // protected true if there's an extra secret preventing random people from joining
  //   This is different than a private game.
  protected: boolean

  // unlisted true if the game isn't listed by the server
  unlisted: boolean

  createdAt: Date

  // lobby, running, completed
  runState: string

  // For lobby mode, these values may change.
  // Once the game starts, these are unmodifiable.
  minimumPlayerCount: integer
  maximumPlayerCount: integer
  maximumTurnCount: integer
  parameters: GameTileParameter[]

  // currentPlayerTurn only has meaning for RUNNING state.
  //   This is a tad redundand from lastTurn.nextPlayerTurn,
  //   but it's important for the first turn, where 'lastTurn' is null.
  currentPlayerTurn: integer

  currentBoardColumnMin: integer
  currentBoardRowMin: integer
  currentBoardColumnMax: integer
  currentBoardRowMax: integer

  lastTurn: ServerTurnCompleted | null

  players: ActiveGamePlayer[]
}


// GameLobbyCreated response from creating a game lobby successfully
export interface GameLobbyCreated {
  gameId: string
}
