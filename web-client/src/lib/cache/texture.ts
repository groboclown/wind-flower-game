// Texture cache.
import Phaser from 'phaser'
import { Texture, TextureLoader } from 'three'

// It would be really nice to integrate this directly with the LoadPlugin.
// However, that uses XHR to load the asset on its own (it's friendly),
// which means we can't use the nice THREE.TextureLoader with it.
// So this just performs a synchronous texture loading.
// Sigh.

let TEXTURE_LOADER: TextureLoader | null = null


export function setupTextureCache(scene: Phaser.Scene): void {
  if (TEXTURE_LOADER === null) {
    scene.cache.addCustom("texture")
    TEXTURE_LOADER = new TextureLoader()
  }
}


export function getCachedTexture(scene: Phaser.Scene, name: string): THREE.Texture {
  return scene.cache.custom.texture.get(name) as THREE.Texture
}


export function loadTexture(scene: Phaser.Scene, name: string, url: string) {
  if (TEXTURE_LOADER === null) {
    throw new Error(`Not initialized`)
  }
  const texture = TEXTURE_LOADER.load(url)
  scene.cache.custom.texture.add(name, texture)
}


export function destroyTextureCache(scene: Phaser.Scene): void {
  const textures = scene.cache.custom.texture.entries
  textures.each((name, texture) => {
    (texture as Texture).dispose()
    scene.cache.custom.texture.remove(name)
  })
}
