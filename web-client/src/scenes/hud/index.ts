// Pre-Load assets at initial load time.
import Phaser from 'phaser'
import {
  store,
} from '../../store'


export default class MainGameScene extends Phaser.Scene {
  score: number
  selectedTokenId: number | null

  constructor() {
    super({ key: 'HudScene', active: true })

    this.score = 0
    this.selectedTokenId = null
  }

  create() {
    const self = this

    // Set up the hud
    let info = this.add.text(
      10, 10,
      'Selected: ' + this.getSelectedToken(),
      { font: '26px Arial', color: '#ffffff' })

    store.subscribe(() => { info.setText('Selected: ' + self.getSelectedToken()) })
  }

  private getSelectedToken(): string {
    const tokenId = store.getState().gameplayInterface.selectedTokenId
    if (tokenId !== null) {
      return String(tokenId)
    }
    return "---"
  }
}
