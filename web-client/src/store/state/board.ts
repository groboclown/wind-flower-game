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

  // Temporary
  rgb: number[]

  height: number
  parameters: TileParameterValue[]
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

export interface GameBoardState {
  // The width and height can change as the board grows.
  size: {minX: number, minY: number, maxX: number, maxY: number}
  segmentSize: BoardSize

  // Segments need a better data structure for optimal
  // use.  Right now, this is just a linear list.  It
  // contains a collection of sparse values unique across
  // (x, y).
  segments: GameBoardSegment[]

  // arrays at each index contains all the segment indexes with coordinate X
  segmentIndexX: Map<number, number[]>
  segmentIndexY: Map<number, number[]>
}


function initialGameBoardState(): GameBoardState {
  return {
    size: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    segmentSize: { width: 0, height: 0 },
    segments: [],
    segmentIndexX: new Map<number, number[]>(),
    segmentIndexY: new Map<number, number[]>(),
  }
}


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
          let xSegs = state.segmentIndexX.get(deltaSeg.x)
          let ySegs = state.segmentIndexY.get(deltaSeg.y)
          let isNew = false
          if (!xSegs) {
            xSegs = []
            state.segmentIndexX.set(deltaSeg.x, xSegs)
            isNew = true
          }
          if (!ySegs) {
            ySegs = []
            state.segmentIndexY.set(deltaSeg.y, ySegs)
            isNew = true
          }
          if (isNew) {
            const newSegment: GameBoardSegment = {
              position: {x: deltaSeg.x, y: deltaSeg.y},
              tiles: [],
            }
            const newIndex = state.segments.push(newSegment) - 1
            xSegs.push(newIndex)
            ySegs.push(newIndex)
            deltaSeg.tiles.forEach((deltaTile) => {
              const params: TileParameterValue[] = []
              deltaTile.parameters.forEach((deltaParam) => {
                params.push({
                  parameterIndex: deltaParam.parameterIndex,
                  quantity: deltaParam.quantity,
                  vector: {x: deltaParam.x, y: deltaParam.y},
                })
              })
              newSegment.tiles.push({
                category: deltaTile.category || 'unset',
                height: deltaTile.z || 0,
                rgb: [0, 0, 0],
                tokenId: deltaTile.tokenId || null,
                parameters: [],
              })
            })
            // Only when a new segment is added to we adjust the board size.
            if (deltaSeg.x < state.size.minX) {
              state.size.minX = deltaSeg.x
            }
            if (deltaSeg.x > state.size.maxX) {
              state.size.maxX = deltaSeg.x
            }
            if (deltaSeg.y < state.size.minY) {
              state.size.minY = deltaSeg.y
            }
            if (deltaSeg.y > state.size.maxY) {
              state.size.maxY = deltaSeg.y
            }
          } else {
            // Find the intersection of xSegs and ySegs.
            //  ... or, just look at one list's indexes and search through it
            //      for the matching segment.
            let segList: number[]
            let checkIndex: keyof(BoardPosition)
            if (xSegs.length < ySegs.length) {
              segList = xSegs
              checkIndex = 'y'
            } else {
              segList = ySegs
              checkIndex = 'x'
            }
            for (let i = 0; i < segList.length; i++) {
              const existingSeg = state.segments[segList[i]]
              // Note that only 1 check is needed; the index for the value that
              //   we know wasn't an exact match for this list.
              if (existingSeg.position[checkIndex] === deltaSeg[checkIndex]) {
                // Found it.
                // Every tile in the updated segment is updated here.
                deltaSeg.tiles.forEach((deltaTile) => {
                  const tileIndex = deltaTile.x + (deltaTile.y * state.segmentSize.width)
                  const existingTile = existingSeg.tiles[tileIndex]
                  if (deltaTile.category !== undefined) {
                    existingTile.category = deltaTile.category
                  }
                  if (deltaTile.z !== undefined) {
                    existingTile.height = deltaTile.z
                  }
                  deltaTile.parameters.forEach((deltaParam) => {
                    let notFound = true
                    for (let i = 0; i < existingTile.parameters.length; i++) {
                      if (existingTile.parameters[i].parameterIndex === deltaParam.parameterIndex) {
                        existingTile.parameters[i].quantity = deltaParam.quantity
                        existingTile.parameters[i].vector.x = deltaParam.x
                        existingTile.parameters[i].vector.y = deltaParam.y
                        notFound = false
                        break
                      }
                    }
                    if (notFound) {
                      existingTile.parameters.push({
                        parameterIndex: deltaParam.parameterIndex,
                        quantity: deltaParam.quantity,
                        vector: {x: deltaParam.x, y: deltaParam.y},
                      })
                    }
                  })
                })
                break
              }
            }
          }
        })
      })
  }
)
