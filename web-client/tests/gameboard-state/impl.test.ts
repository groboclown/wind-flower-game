// Test the game board manager implementation
import {describe, expect} from '@jest/globals'
import { asit } from '../utils/asit'
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

      asit('Marks surrounding tiles as adjacent', async () => {
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

          for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
              expect(seg00.tiles[startIndex + i].vertexHeightCount[j]).toBe(1)
              expect(seg00.tiles[startIndex + i].vertexHeightSum[j]).toBe(0)
              expect(seg00.tiles[startIndex + i].vertexHeight[j]).toBe(0)
            }
          }
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
    })
  })
})
