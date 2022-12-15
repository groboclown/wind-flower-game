// Load up the initial assets required by the preload.
import Phaser from 'phaser'
import { getAssetListRef, getBootImageRef } from '../../assets'

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    this.load.json('asset-list', getAssetListRef())
    this.load.image('loading-background', getBootImageRef())
  }

  create() {
    this.scene.start('PreloadScene')

    /**
     * This is how you would dynamically import the mainScene class (with code splitting),
     * add the mainScene to the Scene Manager
     * and start the scene...
     * with webpack.  Need to use vite loading instead.
     */
    // let someCondition = true
    // if (someCondition)
    //   import(/* webpackChunkName: "mainScene" */ './mainScene').then(mainScene => {
    //     this.scene.add('MainScene', mainScene.default, true)
    //   })
    // else console.log('The mainScene class will not even be loaded by the browser')
  }
}
