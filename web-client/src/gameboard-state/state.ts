// Client side state for the gameboard data.


// ClientTile a single triangle on the board
//   The tile enhances data over what the server sends to the client,
//   to include extra information.  When a client tile is updated,
//   an event is sent.
//   There are Many of these, so they need to be memory efficient.
export interface ClientTile {
  // Server Static data - will not change once the token is placed.

  // category The kind of tile.
  //    null means that the tile hasn't been placed yet.
  category: string | null

  // Identifier for the token number for this tile.
  //   Unique across the game board, not just a segment.
  //   ... but a single token has 6 tiles.
  tokenId: integer | null

  // height Tile vertical position
  height: number

  // Variation on the category texture (purely aesthetic).
  //   TODO is this a server value or client value?
  variation: integer


  // Dynamic server data - may change after the token is placed.

  // parameters current values for the parameters
  //   The key is the parameter index, and the value is the quantity of the parameter.
  //   Tile parameters have a seed, a quantity, and a movement vector.
  //   The client is only aware of the quantity.
  parameters: {[keys: integer]: number}

  // Static client extrapolated data.

  // The tile index within the hex.
  //   Value is:
  //        ._____.
  //       / \ 1 / \
  //      /_0_\./_2_\
  //      \ 3 / \ 5 /
  //       \./_4_\./
  //
  tokenHexTileIndex: integer

  // Dynamic client extrapolated data - changes only based on server data changes

  // Height calculation.
  //   When an adjacent tile is placed, its height is added here.
  //   At least the current tile's height must be here, and therefore the count > 0.
  //   The A/B/C is based on the grid drawing.  These numbers are tightly coupled.
  //   The height is re-computed when a new tile is added.
  //   The number of values for each of these arrays is always 3, one per vertex.
  vertexHeight: integer[]
  vertexHeightSum: integer[]
  vertexHeightCount: integer[]
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

  // Dynamic client load data

  // An identifier that changes when the client segment
  //   data is updated.  Allows for keeping track of
  //   state changes.
  loadId: integer


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
