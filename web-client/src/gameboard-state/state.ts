// Client side state for the gameboard data.


// ClientTile a single triangle on the board
//   The tile enhances data over what the server sends to the client,
//   to include extra information.  When a client tile is updated,
//   an event is sent.
//   There are Many of these, so they need to be memory efficient.
export interface ClientTile {
  // Static data - will not change once the token is placed.

  // category The kind of tile.
  //    null means that the tile hasn't been placed yet.
  category: string | null

  // Identifier for the token number for this tile.
  //   Unique across the game board, not just a segment.
  //   ... but a single token has 6 tiles.
  tokenId: integer | null

  // Variation on the category texture (purely aesthetic).
  variation: integer

  // height Tile vertical position
  height: number


  // Dynamic server data - may change after the token is placed.

  // parameters current values for the parameters
  //   The key is the parameter index, and the value is the quantity of the parameter.
  //   Tile parameters have a seed, a quantity, and a movement vector.
  //   The client is only aware of the quantity.
  parameters: {[keys: integer]: number}


  // Dynamic client extrapolated data - changes only based on server data changes

  // hasAdjacentPlacedTile is there another tile next to this one?
  //   Adjacent here means in one of the 3 positions next to the triangle.
  hasAdjacentPlacedTile: boolean

  // isPlayerPlaceableToken can the current player put a token in this position?
  isPlayerPlaceableToken: boolean
}


// ClientGameBoardSegment a rectangle of tiles on the game board
// The game board contains collections of these.  They relate to
//   the tiles stored on the server fetched in a single batch.
// They also help optimally store a sparse matrix.  The size of
//   a segment (width x height) is fixed.
// The tiles are arranged in a rectangle.
export interface ClientGameBoardSegment {
  // x position of the game board.  This is the underlying upper-left tile X number.
  x: integer
  // y position of the game board.  This is the underlying upper-left tile Y number.
  y: integer

  // segmentId the unique segment identifier
  //   Entirely the construction of the client; the server doesn't know what this is.
  segmentId: string

  // tiles the tiles for the segment, by index.  Some tiles may not have a play yet,
  //   and so have a null 'category' value.
  tiles: ClientTile[]
}


// TileParameterType a value type for a tile.
export interface TileParameterType {
  // name Parameter id, for graphical display
  name: string

  // l10n Localized name, for human reading
  l10n: string

  // key Integer key for quick lookup and short abbreviation
  key: integer
}


// ClientGameBoard the potentially partial in-memory representation
//   of the active game data.
export interface ClientGameBoard {
  // Static per game
  //   Set at the start of the game

  segmentWidth: integer
  segmentHeight: integer

  parameterTypes: {[keys: integer]: TileParameterType}


  // Dynamic server data

  // segments the currently stored segments
  // Indexed by segmentId.
  segments: {[keys: string]: ClientGameBoardSegment}


  // Dynamic client extrapolated data

  // Total board size.
  boardWidth: integer
  boardHeight: integer
  boardMinX: integer
  boardMaxX: integer
  boardMinY: integer
  boardMaxY: integer


  // Client in flight data
  //   Maintained based on client requests that haven't been
  //   received as acknowledged by the server.
  clientPlacedTile0: ClientTile
  clientPlacedTile1: ClientTile
  clientPlacedTile2: ClientTile
  clientPlacedTile3: ClientTile
  clientPlacedTile4: ClientTile
  clientPlacedTile5: ClientTile
  clientPlacedTokenX: integer
  clientPlacedTokenY: integer
  clientPlacedSegmentId: string
}
