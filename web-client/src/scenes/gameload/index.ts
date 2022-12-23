// Load up the initial assets required by the preload.
import Phaser from 'phaser'
import { GAMEBOARD_SCENE_NAME, HUD_SCENE_NAME, GAME_LOAD_SCENE_NAME } from '../names'


export default class GameLoadScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_LOAD_SCENE_NAME })
  }

  create() {
    // Show some pretty graphics.

    // Load data from the server.

    // Start the game.
    this.scene.start(GAMEBOARD_SCENE_NAME)
    this.scene.start(HUD_SCENE_NAME)
  }
}
