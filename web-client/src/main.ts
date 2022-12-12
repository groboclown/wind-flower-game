import * as Phaser from 'phaser'
import { enable3d, Canvas } from '@enable3d/phaser-extension'
import GameBoardScene from './scenes/gameboard'
import HudScene from './scenes/hud'
import PreloadScene from './scenes/preload'
import { getAmmoLibraryRef } from './assets'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  transparent: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  scene: [PreloadScene, GameBoardScene, HudScene],
  ...Canvas()
}

window.addEventListener('load', () => {
  enable3d(() => new Phaser.Game(config))
  .withPhysics(getAmmoLibraryRef())
})
