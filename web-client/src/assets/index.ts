// Load assets.
import Phaser from 'phaser'

// getAmmoLibraryRef get the URL path to the ammo library
// In order to work with Vite's bundling and possible
//   embedding in a relative URL, we need to do some
//   work to find the location of the 'ammo' library.
export function getAmmoLibraryRef() {
  // See https://vitejs.dev/guide/build.html#public-base-path
  // If we used the import.meta.env.BASE_URL format, TypeScript
  //   would throw an error because it doesn't know about vite's
  //   dynamic insertion of the env value.
  // return `./${import.meta.env.BASE_URL}/ammo`
  // return `${import.meta.env.BASE_URL}ammo`
  // But it turns out, this value will work both for absolute
  //   paths, local tests, and embedded paths.
  return './ammo'
}

// ------------------------------------------------------
// Boot / PreLoad hard-coded dependencies.

// Loader function arguments:
// atlas:f       (key, textureURL,  atlasURL,  textureXhrSettings, atlasXhrSettings)
// unityAtlas:f  (key, textureURL,  atlasURL,  textureXhrSettings, atlasXhrSettings)
// bitmapFont:f  (key, textureURL,  xmlURL,    textureXhrSettings, xmlXhrSettings)
// spritesheet:f (key, url,         config,    xhrSettings)
// multiatlas:f  (key, textureURLs, atlasURLs, textureXhrSettings, atlasXhrSettings)

// animation:f (key, url, xhrSettings)
// binary:f (key, url, xhrSettings)
// glsl:f (key, url, xhrSettings)
// image:f (key, url, xhrSettings)
// image:f (key, [url, normal-url], xhrSettings)
// json:f (key, url, xhrSettings)
// plugin:f (key, url, xhrSettings)
// script:f (key, url, xhrSettings)
// svg:f (key, url, xhrSettings)
// text:f (key, url, xhrSettings)
// tilemapCSV:f (key, url, xhrSettings)
// tilemapTiledJSON:f (key, url, xhrSettings)
// tilemapWeltmeister:f (key, url, xhrSettings)
// xml:f (key, url, xhrSettings)

export interface AssetDef {
  name: string
  location: string | string[]
  type: string

  // Used for audio format.
  formats?: {[key: string]: string}

  // for the sprite sheet.  Need to double check the type.
  config?: Phaser.Types.Loader.FileTypes.ImageFrameConfig
}


export interface AllAssets {
  boot: AssetDef[]
}


// getAssetListRef reference to the asset list
//    The asset list is a JSON file that
//    is formatted as AllAssets type.
export function getAssetListRef(): string {
  return './assets.json'
}


export function getBootImageRef(): string {
  return './images/loading-screen/background.svg'
}


export interface ServerInfoDef {
  name: string
  publicKeyBase64: string
  restApiUrl: string
}

export interface AllServers {
  servers: ServerInfoDef[]
}


export function getServerInfoRef(): string {
  return './server-info.json'
}
