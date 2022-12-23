// Load up the initial assets required by the preload.
import Phaser from 'phaser'
import { getAssetListRef, getBootImageRef, getServerInfoRef } from '../../assets'


export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // Assets necessary for the preload scene.
    this.load.json('asset-list', getAssetListRef())
    this.load.image('loading-background', getBootImageRef())
    this.load.json('server-info', getServerInfoRef())
  }

  create() {
    this.scene.start('PreloadScene')
  }
}
