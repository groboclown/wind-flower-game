// Information about the game turn state.  Both historic and current.
// This data is sent by the server to the client.

import { BoardPosition } from "./board"


// A token drawn from the server.
export interface Token {
  name: string
  category: string
  parameters: {
    parameterIndex: number
    quantity: number
  }[]
}

// The action performed by the player
export interface Action {
  // The player can play one tile at one location on their turn.
  token: Token
  position: BoardPosition

  // Land tiles can be assigned a height
  height: number | null
}


export interface GameTurn {
  // Number in the lobby array of players.
  activePlayerIndex: number

  // When the turn started.  Helps keep track of a history.
  turnStarted: Date

  // When the turn ended.  Not valid for an active turn.
  turnEnded: Date | null

  // The action performed by the player.  A do-nothing (null)
  //   action may be allowed.
  action: Action | null

  // The token drawn by the player, sent by the server.
  // Only present if this turn is for the client player.
  drawnToken: Token | null

  // The token discarded by the player.
  discardedToken: Token | null
}
