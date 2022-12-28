// Handle mapping the tile to the texture.

import { ClientTile } from '../../gameboard-state'
import { JSONValueType } from '../../lib/typed-json'
import { CATEGORY_UNKNOWN } from '../../gameboard-state/asset-names'


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


interface JsonCategoryVariation {
  _normal: number[][][]
  _hover: number[][][]
  _select: number[][][]
  _hover_select: number[][][]
}


interface ModeLookup {
  jsonKey: keyof JsonCategoryVariation
  catKey: keyof CategoryTexture
}


const MODES: ModeLookup[] = [
  {jsonKey: "_normal", catKey: "normal"},
  {jsonKey: "_hover", catKey: "hover"},
  {jsonKey: "_select", catKey: "select"},
  {jsonKey: "_hover_select", catKey: "hoverSelect"},
]


export class TextureHandler {
  private categories: CategoryMap


  constructor(uvMap: JSONValueType) {
    const self = this
    // Texture UV map format:
    //   { "categories": {
    //        "(category name)": {
    //            "normal|hover|select|hover-select": [
    //                   // one per triangle, so 6 of these.
    //                   [[u, v], [u, v], [u, v]],
    //            ]
    //        }
    //     }, "width": (image width), "height": (image height)
    //   }

    if (uvMap === null || Array.isArray(uvMap) || typeof uvMap !== 'object') {
      throw new Error('bad uv-map.json format')
    }
    const texelWidth = uvMap.width as number
    const texelHeight = uvMap.height as number
    const uvModeCategories = uvMap.categories as {[key: string]: any}

    this.categories = {}

    Object.keys(uvMap.categories as object).forEach((mapName: string) => {
      let resName = mapName

      let catName = resName
      const pPos = catName.lastIndexOf('.')
      if (pPos > 0) {
        // We don't care about the actual index.  It's just to make them separate.
        catName = catName.substring(0, pPos)
      }
      let cat = self.categories[catName]
      if (cat === undefined) {
        cat = {normal: [], hover: [], select: [], hoverSelect: []}
        self.categories[catName] = cat
      }
      const uvModes = uvModeCategories[mapName] as JsonCategoryVariation

      MODES.forEach((mode) => {
        // Map each UV value in the source (which is in texels) to the (0, 1)
        // required by the texture mapping.
        const uv: number[][][] = []
        const srcMapping = uvModes[mode.jsonKey]
        for (let faceI = 0; faceI < 6; faceI++) {
          const face: number[][] = []
          uv.push(face)
          for (let vertexI = 0; vertexI < 3; vertexI++) {
            face.push([
              (srcMapping[faceI][vertexI][0]) / texelWidth,
              1 - ((srcMapping[faceI][vertexI][1]) / texelHeight),
            ])
          }
        }
        // console.debug(`${mapName} (${cat})[0][0] = ${mapping[0][0][0]}, ${mapping[0][0][1]}`)
        cat[mode.catKey].push({ uv })
      })
    })

    console.log(`Loaded texture categories ${Object.keys(this.categories)}`)
  }


  // getTileUVMap get the 3 vertex UV pair for the tile.
  getTileUVMap(tile: ClientTile, hexIndex: number, hover: boolean, select: boolean): number[][] {
    const cat = tile.category || CATEGORY_UNKNOWN
    const map = this.categories[cat] || this.categories[CATEGORY_UNKNOWN]
    if (map === undefined) {
      throw new Error(`no map asset ${CATEGORY_UNKNOWN} defined`)
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
