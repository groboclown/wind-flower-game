// Events to and from the gameboard state construct.

import { ClientGameBoard, ClientTile } from './state'


export const SEGMENT_ZERO_X = 0
export const SEGMENT_ZERO_Y = 0


// GameBoardRequests calls into the gameboard state
export interface GameBoardRequests {
  // getSegmentId the the segment ID for the given tile coordinate
  //   The segment ID returned is for the segment which covers the
  //   coordinate pair.
  getSegmentId(x: integer, y: integer): string

  // populateNormalizedSegmentPosition fill the "normalized" array with the row, column
  // Normalizes the x,y to the column,row of the upper-left corner, used in segment id.
  populateNormalizedSegmentPosition(x: integer, y: integer, normalized: integer[]): void

  requestSegment(x: integer, y: integer, segmentId: string): void
  markSegmentNotVisible(segmentId: string): void

  // Should be considered a read-only view on the board.
  getGameBoard(): ClientGameBoard

  // Mark the game board token as in-flight.
  // TODO will eventually be replaced by the full API to send an event to the server
  //   for the end-of-turn token placement.
  markPlayedToken(
    segmentId: string,
    x: integer,
    y: integer,
    tiles: ClientTile[],
  ): void
}


// GameBoardStatusHandler calls from the gameboard state
export interface GameBoardStatusHandler {
  // onSegmentLoaded A whole game board segment completed loading from the server.
  onSegmentLoaded(x: integer, y: integer, segmentId: string): void

  // onSegmentUpdated One or more tile in a game board segment was updated from the server.
  onSegmentUpdated(x: integer, y: integer, segmentId: string, tileIndicies: integer[]): void

  // onSegmentRemoved the game board has chosen to remove this segment from memory.
  // Anything holding onto data related to this segment should be removed.
  // This will only be called if:
  //    * markSegmentNotVisible called for this segment.
  //    * no onSegmentLoaded or onSegmentUpdated called after markSegmentNotVisible and before this
  //      event call made.
  onSegmentRemoved(x: integer, y: integer, segmentId: string): void
}
