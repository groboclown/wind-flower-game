import * as Phaser from 'phaser'
import { enable3d, Canvas } from '@enable3d/phaser-extension'
import BootScene from './scenes/boot'
import PreloadScene from './scenes/preload'
import GameBoardScene from './scenes/gameboard'
import HudScene from './scenes/hud'
import MainMenuScene from './scenes/mainmenu'
import GameLoadScene from './scenes/gameload'
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
  // Order is incredibly important
  scene: [
    BootScene, PreloadScene,
    MainMenuScene,
    GameLoadScene,
    GameBoardScene, HudScene,
  ],
  ...Canvas()
}

window.addEventListener('load', () => {
  enable3d(() => new Phaser.Game(config))
  .withPhysics(getAmmoLibraryRef())
})
