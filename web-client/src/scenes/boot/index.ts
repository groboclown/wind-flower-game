// Load up the initial assets required by the preload.
import Phaser from 'phaser'
import { getAssetListRef, getBootImageRef, getServerInfoRef } from '../../assets'


export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // Assets necessary for the preload scene.
    this.load.json('preload/asset-list', getAssetListRef())
    this.load.image('preload/background', getBootImageRef())

    // The server info is constructed from the server that hosts
    //   the game client.
    this.load.json('server-info', getServerInfoRef())
  }

  create() {
    this.scene.start('PreloadScene')
  }
}
