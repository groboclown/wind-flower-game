import * as Phaser from 'phaser'
import { enable3d, Canvas } from '@enable3d/phaser-extension'
import GameBoardScene from './scenes/gameboard'
import PreloadScene from './scenes/preload'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  transparent: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  scene: [PreloadScene, GameBoardScene],
  ...Canvas()
}

// In order to work with Vite's bundling and possible
//   embedding in a relative URL, we need to do some
//   work to find the location of the 'ammo' library.
window.addEventListener('load', () => {
  enable3d(() => new Phaser.Game(config))
  .withPhysics(new URL('/ammo', import.meta.url).href)
})
