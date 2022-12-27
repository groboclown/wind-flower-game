// Load up the initial assets required by the preload.
import Phaser from 'phaser'
import { GAMEBOARD_SCENE_NAME, HUD_SCENE_NAME, GAME_LOAD_SCENE_NAME } from '../names'


// const EVENT__SERVER_LOAD_PROGRESS = "server load progress"
const EVENT__SERVER_LOAD_COMPLETED = "server load completed"


export default class GameLoadScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_LOAD_SCENE_NAME })
  }

  preload() {
    const self = this

    this.add.image(this.centerX(), this.centerY(), 'game-load/background')
    this.events.once(EVENT__SERVER_LOAD_COMPLETED, () => {
      console.log(`End game load screen`)
      self.cameras.main.fadeOut(1000, 0, 0, 0)
    })
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // Start the game.
      console.log(`Start game scenes`)
      this.scene.start(GAMEBOARD_SCENE_NAME)
      this.scene.start(HUD_SCENE_NAME)
    })
  }


  create() {
    const self = this

    // Load data from the server.

    // TODO this is a place-holder.
    //   Note that the normal Phaser asset loading doesn't work here.
    // setTimeout(() => { self.events.emit(EVENT__SERVER_LOAD_COMPLETED) }, 1)
    new Promise(() => {
      console.log(`Server load completed`)
      self.events.emit(EVENT__SERVER_LOAD_COMPLETED)
    })
  }

  private centerX(): number {
    return (0 + this.sys.game.canvas.width) / 2;
  }

  private centerY(): number {
    return (0 + this.sys.game.canvas.height) / 2;
  }
}
