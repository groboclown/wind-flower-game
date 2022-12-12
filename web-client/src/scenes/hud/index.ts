// Pre-Load assets at initial load time.
import Phaser from 'phaser'

export default class MainGameScene extends Phaser.Scene {
  score: number

  constructor() {
    super({ key: 'HudScene', active: true })

    this.score = 0
  }

  create() {
    const self = this;

    // Set up the hud
    let info = this.add.text(10, 10, 'Score: 0', { font: '48px Arial', color: '#ffffff' });

    //  Grab a reference to the Game Scene
    let ourGame = this.scene.get('GameBoardScene');

    //  Listen for events from it
    ourGame.events.on('addScore', function () {
        self.score += 10;
        info.setText('Score: ' + self.score);
    });
  }
}
