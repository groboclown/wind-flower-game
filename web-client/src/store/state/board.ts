// The Game Board
import { createReducer } from '@reduxjs/toolkit'
import {
  updateServerPerformanceInformation,
  updateServerTurn,
} from '../actions/api'


export interface BoardPosition {
  x: number
  y: number
}

export interface BoardSize {
  width: number
  height: number
}

export interface BoardRect {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

// TileParameter a single property for a tile, which has
// a quantity and a flow vector.
export interface TileParameterValue {
  parameterIndex: number
  quantity: number
  vector: BoardPosition
}

// A single triangle on the board
export interface Tile {
  category: string | null

  // Identifier for the token number for this tile.
  // Unique across the game board, not just a segment.
  tokenId: number | null

  // Variation on the category texture (purely aesthetic).  This will
  // be modulated with the count so it will never generate an error.
  variation: number

  height: number
  parameters: TileParameterValue[]
}


// Default empty tile template.
export const EMPTY_TILE: Tile = {
  category: null,
  variation: 0,
  height: -10,
  tokenId: null,
  parameters: [],
}


// GameBoardSegment a rectangle of tiles on the game board
// The game board contains collections of these.  They relate to
//   the tiles stored on the server fetched in a single batch.
// They also help optimally store a sparse matrix.  The size of
//   a segment (width x height) is fixed.
// The tiles are arranged in a rectangle.
export interface GameBoardSegment {
  position: BoardPosition
  tiles: Tile[]
}


// Get the key for the segment, as it appears in the GameBoardState segments map.
export function getGameBoardSegmentKey(segment: GameBoardSegment): string {
  return `${segment.position.x},${segment.position.y}`
}


export interface GameBoardState {
  // The width and height can change as the board grows.
  size: {minX: number, minY: number, maxX: number, maxY: number}
  segmentSize: BoardSize

  // The whole game board is a map of '{x},{y}' values,
  // where x & y are the position values of the game board segment.
  // This is used elsewhere as the "index" for the segment.
  segments: {[key: string]: GameBoardSegment}
}


function initialGameBoardState(): GameBoardState {
  return {
    size: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    segmentSize: { width: 0, height: 0 },
    segments: {},
  }
}

// TODO the game board itself will probably be kept outside the state.
export const gameBoardReducer = createReducer(
  initialGameBoardState(), (builder) => {
    builder
      .addCase(updateServerPerformanceInformation, (state, action) => {
        // Api response from the server describing the attributes of the
        //   game.
        state.segmentSize.width = action.payload.maximumBoardSegmentWidth
        state.segmentSize.height = action.payload.maximumBoardSegmentHeight
      })

      .addCase(updateServerTurn, (state, action) => {
        // Just update the game board for this action.
        action.payload.segmentChanges.forEach((deltaSeg) => {
          const segmentIndex = `${deltaSeg.x},${deltaSeg.y}`
          let segment = state.segments[segmentIndex]
          if (segment === undefined) {
            // Need to create the segment.
            const tiles: Tile[] = []
            const count = state.segmentSize.width * state.segmentSize.height
            for (let i = 0; i < count; i++) {
              tiles.push({...EMPTY_TILE})
            }
            segment = {
              position: { x: deltaSeg.x, y: deltaSeg.y },
              tiles,
            }
            state.segments[segmentIndex] = segment
          }

          deltaSeg.tiles.forEach((deltaTile) => {
            const tileIndex = (state.segmentSize.width * deltaTile.y) + deltaTile.x
            if (tileIndex < 0 || tileIndex >= segment.tiles.length) {
              console.error(`Invalid server token position ${deltaTile.x}, ${deltaTile.y}`)
            } else {
              const tile = segment.tiles[tileIndex]
              tile.category = (deltaTile.category === undefined ? tile.category : deltaTile.category)
              tile.height = (deltaTile.z === undefined ? tile.height : deltaTile.z)
              tile.tokenId = (deltaTile.tokenId === undefined ? tile.tokenId : deltaTile.tokenId)

              // TODO merge parameters
            }
          })
        })
      })
  }
)
