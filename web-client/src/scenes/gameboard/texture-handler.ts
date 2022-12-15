// Handle mapping the tile to the texture.

import { Tile } from '../../store'
import { JSONValueType } from "../../lib/typed-json"

interface HexUV {
  // for each of the 6 tiles in the hexagon, the 3 verticies' (u, v) pair
  uv: number[][][]
}

interface CategoryTexture {
  normal: HexUV[],
  hover: HexUV[],
  select: HexUV[],
  hoverSelect: HexUV[],
}

interface CategoryMap {
  [key: string]: CategoryTexture
}


const UNKNOWN_CATEGORY = 'unknown'


export class TextureHandler {
  private categories: CategoryMap

  constructor(uvMap: JSONValueType) {
    if (uvMap === null || Array.isArray(uvMap) || typeof uvMap !== 'object') {
      throw new Error('bad uv-map.json format')
    }
    const texelWidth = uvMap.width as number
    const texelHeight = uvMap.height as number
    const uvCategories = uvMap.categories as {[key: string]: number[][][]}

    this.categories = {}
    Object.keys(uvMap.categories as object).forEach((mapName: string) => {
      let resName = mapName
      let hover = false
      let select = false
      if (resName.endsWith(".hover")) {
        hover = true
        resName = resName.substring(0, resName.lastIndexOf('.'))
      } else if (resName.endsWith(".select")) {
        select = true
        resName = resName.substring(0, resName.lastIndexOf('.'))
      } else if (resName.endsWith(".hover-select")) {
        hover = true
        select = true
        resName = resName.substring(0, resName.lastIndexOf('.'))
      }
      let cat = resName
      const pPos = cat.lastIndexOf('.')
      if (pPos > 0) {
        // We don't care about the actual index.  It's just to make them separate.
        cat = cat.substring(0, pPos)
      }

      // Map each UV value in the source (which is in texels) to the (0, 1)
      // required by the texture mapping.
      const uv: number[][][] = []
      const mapping = uvCategories[mapName]
      for (let faceI = 0; faceI < 6; faceI++) {
        const face: number[][] = []
        uv.push(face)
        for (let vertexI = 0; vertexI < 3; vertexI++) {
          face.push([
            (mapping[faceI][vertexI][0]) / texelWidth,
            1 - ((mapping[faceI][vertexI][1]) / texelHeight),
          ])
        }
      }
      // console.debug(`${mapName} (${cat})[0][0] = ${mapping[0][0][0]}, ${mapping[0][0][1]}`)

      let tex: CategoryTexture | undefined = this.categories[cat]
      if (tex === undefined) {
        tex = {
          normal: [],
          hover: [],
          select: [],
          hoverSelect: [],
        }
        this.categories[cat] = tex
      }
      if (hover && select) {
        tex.hoverSelect.push({ uv })
      } else if (hover) {
        tex.hover.push({ uv })
      } else if (select) {
        tex.select.push({ uv })
      } else {
        tex.normal.push({ uv })
      }
    })

    console.log(`Loaded texture categories ${Object.keys(this.categories)}`)
  }

  // getTileUVMap get the 3 vertex UV pair for the tile.
  getTileUVMap(tile: Tile, hexIndex: number, hover: boolean, select: boolean): number[][] {
    const cat = tile.category || UNKNOWN_CATEGORY
    const map = this.categories[cat] || this.categories[UNKNOWN_CATEGORY]
    if (map === undefined) {
      throw new Error(`no map asset ${UNKNOWN_CATEGORY} defined`)
    }
    let sub = map.normal
    if (hover) {
      if (select) {
        sub = map.hoverSelect
      } else {
        sub = map.hover
      }
    } else if (select) {
      sub = map.select
    }
    return sub[tile.variation % sub.length].uv[hexIndex]
  }
}
