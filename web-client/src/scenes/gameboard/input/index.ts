// Standard Controls for the game board
import { Scene3D, THREE } from '@enable3d/phaser-extension'
import { Input } from 'phaser'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'


export interface Controls {
  update(): void
  dispose(): void
  lookAt(at: THREE.Vector3): void
  getTarget(): THREE.Vector3
  positionAt(at: THREE.Vector3): void
  registerOnUpdateListener(callback: (controls: Controls) => void): void
  getScreenFocusPositions(): THREE.Vector3[]
}


export function createControls(scene: Scene3D): Controls {
  // return new CustomControls(scene)
  return new OrbitControlsWrapper(scene)
}


export class OrbitControlsWrapper implements Controls {
  private orbit: OrbitControls
  private tickListener: ((controls: Controls) => void) | null
  private orbitUpdate: (() => boolean)

  constructor(scene: Scene3D) {
    this.orbit = new OrbitControls(
      scene.third.camera,
      document.getElementById('enable3d-phaser-canvas') || scene.third.renderer.domElement,
    )
    this.orbitUpdate = this.orbit.update
    this.orbit.update = () => this.tick()

    // min == 0 means can look straight down.
    this.orbit.minPolarAngle = 0
    // max == PI / 2 means can looks straight across.
    this.orbit.maxPolarAngle = Math.PI / 3

    this.tickListener = null
  }

  update() {
    this.tick()
  }

  dispose() {
    this.orbit.dispose()
  }

  lookAt(at: THREE.Vector3) {
    this.orbit.target.set(at.x, at.y, at.z)
    this.orbit.update()
  }

  positionAt(at: THREE.Vector3) {
    this.orbit.object.position.set(at.x, at.y, at.z)
  }

  getTarget(): THREE.Vector3 {
    return new THREE.Vector3().copy(this.orbit.target)
  }

  registerOnUpdateListener(callback: (controls: Controls) => void): void {
    this.tickListener = callback
  }

  getScreenFocusPositions(): THREE.Vector3[] {
    // Each touch + mouse
    return []
  }

  // Internal override for the control update call.
  private tick(): boolean {
    // console.log(`Control tick`)
    if (typeof this.orbitUpdate !== 'function') {
      console.log(`ERROR updated orbitUpdate :: ${typeof this.orbitUpdate}`)
      return false
    }
    const updater = this.orbitUpdate
    const ret = updater()
    if (this.tickListener !== null) {
      this.tickListener(this)
    }
    return ret
  }
}


const EPS = 0.000001
const TWO_PI = 2 * Math.PI;


export class CustomControls implements Controls {
  private camera: THREE.Camera
  private target: THREE.Vector3
  private input: Input.InputPlugin

  private mousePressLocation: THREE.Vector2
  private mouseActionStart: boolean

  // current position in spherical coordinates
  private spherical: THREE.Spherical
  private sphericalDelta: THREE.Spherical
  private scale: number

  // damping of 1 is same as no dampning
  private dampeningFactor: number

  private zoomChanged: boolean

  private rotateStart: THREE.Vector2
  private rotateEnd: THREE.Vector2
  // private rotateDelta: THREE.Vector2

  private panOffset: THREE.Vector3
  private panStart: THREE.Vector2
  private panEnd: THREE.Vector2
  // private panDelta: THREE.Vector2

  // private dollyStart: THREE.Vector2
  // private dollyEnd: THREE.Vector2
  // private dollyDelta: THREE.Vector2

  minDistance: number
  maxDistance: number
  minZoom: number
  maxZoom: number
  zoomSpeed: number
  panSpeed: number
  keyPanSpeed: number

  // if false, pan orthogonal to world-space direction camera.up
  screenSpacePanning: boolean

  // All rotations; in radians
  rotateSpeed: number

  // Vertical orbit angle range, in radians
  minPolarAngle: number
  maxPolarAngle: number

  // Horizontal orbit angle range
  minAzimuthAngle: number
  maxAzimuthAngle: number

  constructor(scene: Scene3D) {
    const self = this

    this.camera = scene.third.camera
    this.target = scene.third.scene.position
    this.input = scene.input

    this.mousePressLocation = new THREE.Vector2()
    this.mouseActionStart = false

    this.dampeningFactor = 1

    this.minDistance = 0
    this.maxDistance = Infinity
    this.minZoom = 0
    this.maxZoom = Infinity
    this.zoomSpeed = 1.0
    this.panSpeed = 1.0
    this.keyPanSpeed = 3.0
    this.screenSpacePanning = true
    this.rotateSpeed = Math.PI / 8.0
    this.minPolarAngle = 0
    this.maxPolarAngle = Math.PI
    this.minAzimuthAngle = -Infinity
    this.maxAzimuthAngle = Infinity

		this.spherical = new THREE.Spherical()
		this.sphericalDelta = new THREE.Spherical()

		this.scale = 1
		this.panOffset = new THREE.Vector3()
		this.zoomChanged = false

		this.rotateStart = new THREE.Vector2()
		this.rotateEnd = new THREE.Vector2()
		// this.rotateDelta = new THREE.Vector2()

		this.panStart = new THREE.Vector2()
		this.panEnd = new THREE.Vector2()
		// this.panDelta = new THREE.Vector2()

		// this.dollyStart = new THREE.Vector2()
		// this.dollyEnd = new THREE.Vector2()
		// this.dollyDelta = new THREE.Vector2()

    this.input.mouse.onMouseDown = (event: MouseEvent) => self.onMouseButton(event)
    this.input.mouse.onMouseUp = (event: MouseEvent) => self.onMouseButton(event)
    this.input.mouse.onMouseMove = (event: MouseEvent) => self.onMouseMove(event)
    this.input.mouse.onMouseWheel = (event: WheelEvent) => self.onMouseWheel(event)
    this.input.mouse.startListeners()
    // this.input.gamepad.gamepads[0]?.addListener(this.onGamePad)
  }

  registerOnUpdateListener(): void {
    // do nothing
  }

  getScreenFocusPositions(): THREE.Vector3[] {
    return []
  }

  update() {
    const cursors = this.input.keyboard.createCursorKeys()
    if (cursors.up.isDown) {

    }
    if (cursors.down.isDown) {

    }
    if (cursors.left.isDown) {

    }
    if (cursors.right.isDown) {

    }

    this.input.gamepad?.gamepads.forEach((pad) => {
      if (pad.leftStick.x !== 0) {

      }
      if (pad.leftStick.y !== 0) {

      }
      if (pad.rightStick.x !== 0) {

      }
      if (pad.rightStick.y !== 0) {

      }
    })

    this.tick()
  }

  dispose() {
    this.input.mouse.stopListeners()
  }

  lookAt(at: THREE.Vector3) {
    this.target = at
  }

  getTarget(): THREE.Vector3 {
    return new THREE.Vector3().copy(this.target)
  }

  positionAt(at: THREE.Vector3) {
    this.camera.position.set(at.x, at.y, at.z)
  }

  onMouseButton(event: MouseEvent) {
    this.mousePressLocation.set(event.clientX, event.clientY)
    this.mouseActionStart = true
  }

  onMouseMove(event: MouseEvent) {
    // mouse.buttons == sum of these
    // 0: No button or un-initialized
    // 1: Primary button (usually the left button)
    // 2: Secondary button (usually the right button)
    // 4: Auxiliary button (usually the mouse wheel button or middle button)
    // 8: 4th button (typically the "Browser Back" button)
    // 16: 5th button (typically the "Browser Forward" button)

    if ((event.buttons | 1) !== 0) {
      if (this.mouseActionStart) {
        this.rotateCameraStart(event.clientX, event.clientY)
      } else {
        this.rotateCameraAdditional(event.clientX, event.clientY)
      }
    }
    if ((event.buttons | 2) !== 0) {
      if (this.mouseActionStart) {
        this.panCameraStart(event.clientX, event.clientY)
      } else {
        this.panCameraAdditional(event.clientX, event.clientY)
      }
    }
    // if ((event.buttons | 4) !== 0) {

    this.mouseActionStart = false
  }

  onMouseWheel(event: WheelEvent) {
    this.zoomCameraAdditonal(event.deltaY)
  }

  panCameraStart(x: number, y: number) {
    this.panStart.set(x, y)
    this.panEnd.set(x, y)
  }

  panCameraAdditional(x: number, y: number) {
    this.panEnd.add(new THREE.Vector2(x, y))
  }

  rotateCameraStart(vert: number, horiz: number) {
    this.rotateStart.set(vert, horiz)
    this.rotateEnd.set(vert, horiz)
  }

  rotateCameraAdditional(vert: number, horiz: number) {
    this.rotateEnd.add(new THREE.Vector2(vert, horiz))
  }

  zoomCameraStart(amount: number) {
    console.debug(`todo: zoom start at ${amount}`)
  }

  zoomCameraAdditonal(amount: number) {
    console.debug(`todo: zoom additionally by ${amount}`)
  }


  tick() {
    const position = this.camera.position
    const offset = new THREE.Vector3()

    // so camera.up is the orbit axis
    const quat = new THREE.Quaternion().setFromUnitVectors(this.camera.up, new THREE.Vector3(0, 1, 0 ))
    const quatInverse = quat.clone().invert()

    const lastPosition = new THREE.Vector3()
    const lastQuaternion = new THREE.Quaternion()

    offset.copy( position ).sub( this.target )

    // rotate offset to "y-axis-is-up" space
    offset.applyQuaternion( quat )

    // angle from z-axis around y-axis
    this.spherical.setFromVector3( offset )

    // No dampning effect.
    this.spherical.theta += this.sphericalDelta.theta * this.dampeningFactor
    this.spherical.phi += this.sphericalDelta.phi * this.dampeningFactor

    // restrict theta to be between desired limits

    let min = this.minAzimuthAngle
    let max = this.maxAzimuthAngle

    if (isFinite(min) && isFinite(max)) {
      if (min < -Math.PI) {
        min += TWO_PI;
      } else if (min > Math.PI) {
        min -= TWO_PI
      }

      if (max < -Math.PI) {
        max += TWO_PI
      } else if (max > Math.PI) {
        max -= TWO_PI
      }

      if (min <= max) {
        this.spherical.theta = Math.max(min, Math.min(max, this.spherical.theta))
      } else {
        this.spherical.theta = (this.spherical.theta > (min + max) / 2)
          ? Math.max(min, this.spherical.theta)
          : Math.min(max, this.spherical.theta)
      }
    }

    // restrict phi to be between desired limits
    this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi))

    this.spherical.makeSafe()

    this.spherical.radius *= this.scale

    // restrict radius to be between desired limits
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius))

    // move target to panned location
    this.target.addScaledVector(this.panOffset, this.dampeningFactor)
    offset.setFromSpherical(this.spherical)

    // rotate offset back to "camera-up-vector-is-up" space
    offset.applyQuaternion(quatInverse)
    position.copy(this.target).add(offset)
    this.camera.lookAt(this.target)

    this.sphericalDelta.theta *= 1 - this.dampeningFactor
    this.sphericalDelta.phi *= 1 - this.dampeningFactor
    this.panOffset.multiplyScalar(1 - this.dampeningFactor)
    this.scale = 1

    // update condition is:
    // min(camera displacement, camera rotation in radians)^2 > EPS
    // using small-angle approximation cos(x/2) = 1 - x^2 / 8

    if (
        this.zoomChanged ||
        lastPosition.distanceToSquared(this.camera.position) > EPS  ||
        8 * ( 1 - lastQuaternion.dot(this.camera.quaternion)) > EPS
    ) {
      lastPosition.copy(this.camera.position)
      lastQuaternion.copy(this.camera.quaternion)
      this.zoomChanged = false
    }
  }
}
