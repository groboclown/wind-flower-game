// Pre-Load assets at initial load time.
import Phaser from 'phaser'
import { AllAssets } from '../../assets'
import { setupTextureCache, loadTexture } from '../../lib/cache/texture'

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' })
  }

  preload() {
    this.loadAssets(this.cache.json.get('asset-list') as AllAssets)
    this.add.image(this.centerX(), this.centerY(), 'loading-background')
    this.createProgressbar(this.centerX(), this.centerY() + 200)
  }

  createProgressbar(x: number, y: number) {
    const self = this

    // size & position
    let width = 400;
    let height = 20;
    let xStart = x - width / 2
    let yStart = y - height / 2

    // border size
    let borderOffset = 2

    let borderRect = new Phaser.Geom.Rectangle(
      xStart - borderOffset,
      yStart - borderOffset,
      width + borderOffset * 2,
      height + borderOffset * 2)

    let border = this.add.graphics({
      lineStyle: {
          width: 5,
          color: 0xaaaaaa,
      }
    })
    border.strokeRectShape(borderRect)

    const progressbar = this.add.graphics()

    /**
     * Updates the progress bar.
     *
     * @param {number} percentage
     */
    const updateProgressbar = (percentage: number) => {
        progressbar.clear()
        progressbar.fillStyle(0xffffff, 1)
        progressbar.fillRect(xStart, yStart, percentage * width, height)
    }

    this.load.on(Phaser.Loader.Events.PROGRESS, updateProgressbar)

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      self.load.off(Phaser.Loader.Events.PROGRESS, updateProgressbar)
      self.cameras.main.fadeOut(1000, 0, 0, 0)
    })
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      self.scene.start('GameBoardScene')
      self.scene.start('HudScene')
    })
  }

  loadAssets(assets: AllAssets) {
    setupTextureCache(this)

    // Load up the boot-time assets.
    assets.boot.forEach((asset) => {
      const formats = asset.formats || {}
      let location0: string
      let location1: string | null
      if (Array.isArray(asset.location)) {
        if (asset.location.length !== 2) {
          console.error(`Asset ${asset.name} location must be a string or a list of 2 strings.`)
          return
        }
        location0 = asset.location[0]
        location1 = asset.location[1]
      } else {
        location0 = asset.location
        location1 = null
      }

      switch (asset.type) {
        case 'atlas':
          if (location1 !== null) {
            this.load.atlas(asset.name, location0, location1)
          } else {
            console.error(`Asset ${asset.name} of type ${asset.type} must have 2 locations`)
          }
          break
        case 'unityAtlas':
          if (location1 !== null) {
            this.load.unityAtlas(asset.name, location0, location1)
          } else {
            console.error(`Asset ${asset.name} of type ${asset.type} must have 2 locations`)
          }
          break
        case 'bitmapFont':
          if (location1 !== null) {
            this.load.bitmapFont(asset.name, location0, location1)
          } else {
            console.error(`Asset ${asset.name} of type ${asset.type} must have 2 locations`)
          }
          break
        case 'multiatlas':
          if (location1 !== null) {
            this.load.bitmapFont(asset.name, location0, location1)
          } else {
            console.error(`Asset ${asset.name} of type ${asset.type} must have 2 locations`)
          }
          break
        case 'spritesheet':
          if (asset.config !== null) {
            this.load.spritesheet(asset.name, location0, asset.config)
          }
          break
        case 'audio':
          // Priority for loading.
          // yeah, MP3 is not supported.  You shouldn't use it.
          if (formats.opus !== undefined && this.sys.game.device.audio.opus) {
            this.load.audio(asset.name, formats.opus)
          } else if (formats.webm !== undefined && this.sys.game.device.audio.webm) {
            this.load.audio(asset.name, formats.webm)
          } else if (formats.ogg !== undefined && this.sys.game.device.audio.ogg) {
            this.load.audio(asset.name, formats.ogg)
          } else if (formats.wav !== undefined && this.sys.game.device.audio.wav) {
            this.load.audio(asset.name, formats.wav)
          }
          break
        case 'html':
          this.load.html(asset.name, location0)
          break
        case 'animation':
          this.load.animation(asset.name, location0)
          break
        case 'binary':
          this.load.binary(asset.name, location0)
          break
        case 'glsl':
          this.load.glsl(asset.name, location0)
          break
        case 'image':
          if (location0 !== null && location1 !== null) {
            // [image, normal]
            this.load.image(asset.name, [location0, location1])
          } else {
            this.load.image(asset.name, location0)
          }
          break
        case 'json':
          this.load.json(asset.name, location0)
          break
        case 'plugin':
          this.load.plugin(asset.name, location0)
          break
        case 'script':
          this.load.script(asset.name, location0)
          break
        case 'svg':
          this.load.svg(asset.name, location0)
          break
        case 'text':
          this.load.text(asset.name, location0)
          break
        case 'tilemapCSV':
          this.load.tilemapCSV(asset.name, location0)
          break
        case 'tilemapTiledJSON':
          this.load.tilemapTiledJSON(asset.name, location0)
          break
        case 'tilemapImpact':
          this.load.tilemapImpact(asset.name, location0)
          break
        case 'xml':
          this.load.xml(asset.name, location0)
          break

        // 3d assets
        case 'texture':
          loadTexture(this, asset.name, location0)
          break
      }
    })
  }

  private centerX(): number {
      return (0 + this.sys.game.canvas.width) / 2;
  }

  private centerY(): number {
      return (0 + this.sys.game.canvas.height) / 2;
  }
}
