// Test the game board manager implementation
import { describe, it, expect } from '@jest/globals'
import { GameBoardManagerImpl } from '../../src/gameboard-state/impl'
import { CATEGORY_EMPTY, CATEGORY_PLACEABLE } from '../../src/gameboard-state/asset-names'
import { createAccount, MockHostApi, SegmentDataServer } from '../mocks/host-api'

describe('game board manager implementation', () => {
  const mockAccount = createAccount('ac1')
  describe('adjacency logic', () => {
    describe('with two adjacent, centered tiles', () => {
      const server = new SegmentDataServer([
        // Leave space such that surrounding the tiles is empty.
        // Empty tokens at:
        //   Column 0:
        //   ( 0, 0), ( 0, 2), ( 0, 4), ( 0, 6)
        //     ( 3, 1),          ( 3, 5), ( 3, 7)
        //   ( 6, 0),          ( 6, 4), ( 6, 6)
        //     ( 9, 1), ( 9, 3), ( 9, 5), ( 9, 7)
        //   (12, 0), (12, 2), (12, 4), (12, 6)

        // Token 0
        { x: 3, y: 3, h: 16, c: 'g', t: 0, p: [] },
        { x: 4, y: 3, h: 16, c: 'g', t: 0, p: [] },
        { x: 5, y: 3, h: 16, c: 'g', t: 0, p: [] },
        { x: 3, y: 4, h: 16, c: 'g', t: 0, p: [] },
        { x: 4, y: 4, h: 16, c: 'g', t: 0, p: [] },
        { x: 5, y: 4, h: 16, c: 'g', t: 0, p: [] },

        // Token 1
        { x: 6, y: 2, h: 26, c: 'b', t: 0, p: [] },
        { x: 7, y: 2, h: 26, c: 'b', t: 0, p: [] },
        { x: 8, y: 2, h: 26, c: 'b', t: 0, p: [] },
        { x: 6, y: 3, h: 26, c: 'b', t: 0, p: [] },
        { x: 7, y: 3, h: 26, c: 'b', t: 0, p: [] },
        { x: 8, y: 3, h: 26, c: 'b', t: 0, p: [] },
      ])
      const blankNonAdjacent: integer[][] = [
        [0, 0], [0, 6],
        [3, 7],
        [6, 6],
        [9, 5], [9, 7],
        [12, 0], [12, 2], [12, 4], [12,6],
      ]
      const blankAdjacent: integer[][] = [
        [0, 2], [0, 4],
        [3, 1], [3, 5],
        [6, 0], [6, 4],
        [9, 1], [9, 3],
      ]
      const hostApi = new MockHostApi(server, mockAccount.account)

      it('marks surrounding tiles as adjacent for single segment', async () => {
        const width = 16
        const height = 9
        const impl = new GameBoardManagerImpl(hostApi, 'game', width, height, [])
        await impl.loadSegment('0,0', 0, 0)

        // ensure the requested segment exists
        const seg00 = impl.board.segments['0,0']
        expect(seg00).not.toBe(undefined)
        expect(seg00.tiles.length).toBe(width * height)

        // ensure server values are in the segment.
        const token0Index = 3 + (3 * width)
        expect(seg00.tiles[token0Index            ].category).toBe('g')
        expect(seg00.tiles[token0Index + 1        ].category).toBe('g')
        expect(seg00.tiles[token0Index + 2        ].category).toBe('g')
        expect(seg00.tiles[token0Index     + width].category).toBe('g')
        expect(seg00.tiles[token0Index + 1 + width].category).toBe('g')
        expect(seg00.tiles[token0Index + 2 + width].category).toBe('g')

        const token1Index = 6 + (2 * width)
        expect(seg00.tiles[token1Index            ].category).toBe('b')
        expect(seg00.tiles[token1Index + 1        ].category).toBe('b')
        expect(seg00.tiles[token1Index + 2        ].category).toBe('b')
        expect(seg00.tiles[token1Index     + width].category).toBe('b')
        expect(seg00.tiles[token1Index + 1 + width].category).toBe('b')
        expect(seg00.tiles[token1Index + 2 + width].category).toBe('b')

        // check still blank tiles (not adjacent)
        blankNonAdjacent.forEach((pos) => {
          const startIndex = pos[0] + (pos[1] * width)
          expect(seg00.tiles[startIndex            ].category).toBe(CATEGORY_EMPTY)
          expect(seg00.tiles[startIndex + 1        ].category).toBe(CATEGORY_EMPTY)
          expect(seg00.tiles[startIndex + 2        ].category).toBe(CATEGORY_EMPTY)
          expect(seg00.tiles[startIndex     + width].category).toBe(CATEGORY_EMPTY)
          expect(seg00.tiles[startIndex + 1 + width].category).toBe(CATEGORY_EMPTY)
          expect(seg00.tiles[startIndex + 2 + width].category).toBe(CATEGORY_EMPTY)
        })

        // check discovered adjacent tiles
        blankAdjacent.forEach((pos) => {
          const startIndex = pos[0] + (pos[1] * width)
          expect(seg00.tiles[startIndex            ].category).toBe(CATEGORY_PLACEABLE)
          expect(seg00.tiles[startIndex + 1        ].category).toBe(CATEGORY_PLACEABLE)
          expect(seg00.tiles[startIndex + 2        ].category).toBe(CATEGORY_PLACEABLE)
          expect(seg00.tiles[startIndex     + width].category).toBe(CATEGORY_PLACEABLE)
          expect(seg00.tiles[startIndex + 1 + width].category).toBe(CATEGORY_PLACEABLE)
          expect(seg00.tiles[startIndex + 2 + width].category).toBe(CATEGORY_PLACEABLE)
        })
      })

      it('computes edge heights correctly', async () => {
        const width = 16
        const height = 9
        const impl = new GameBoardManagerImpl(hostApi, 'game', width, height, [])
        await impl.loadSegment('0,0', 0, 0)
        const seg00 = impl.board.segments['0,0']

        for (let x = 0; x < width; x++) {
          let y = 0
          const tileIdx = x + (y * width)
          const tile = seg00.tiles[tileIdx]
          let vertexWith3a = -1
          let vertexWith3b = -1
          switch (tile.tokenHexTileIndex) {
            // The center vertex will always have 3 items in it.

            case 0:
              // Top hex token.  Vertex A (index 0) is at the top, Vertex C (2)
              //   is in the middle of the hex.  Vertex B (index 1) is conditionally
              //   built up with the left token.
              vertexWith3a = 2
              if (x > 0) {
                vertexWith3b = 1
              }
              break
            case 1:
              vertexWith3a = 0
              break
            case 2:
              vertexWith3a = 2
              break
            case 3:
              vertexWith3a = 1
              break
            case 4:
              vertexWith3a = 1
              vertexWith3b = 2
              break
            case 5:
              vertexWith3a = 2
              if (x < width - 1) {
                vertexWith3b = 1
              }
              break
          }
          for (let vIdx = 0; vIdx < 3; vIdx++) {
            if (vIdx === vertexWith3a || vIdx === vertexWith3b) {
              expect(tile.vertexHeightCount[vIdx]).toBe(3)
            } else {
              expect(tile.vertexHeightCount[vIdx]).toBe(1)
            }
          }

          // Now the bottom row
          // y = height - 1
        }
      })
    })
  })
})
