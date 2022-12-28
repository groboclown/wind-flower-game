// Based heavily off of three.js "OrbitControls" file.
// Split apart concept of input vs. controlling the camera.

import {
  Camera, OrthographicCamera, PerspectiveCamera, Vector3,
  Quaternion, Spherical, Vector2, Matrix4,
} from 'three'
import { CameraControl } from './camera-control'

const EPS = 0.000001



// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

export class OrbitCameraControl implements CameraControl {
  private camera: Camera
  private orthoCamera: OrthographicCamera | null
  private perspCamera: PerspectiveCamera | null

  // API
  enabled: boolean
  target: Vector3

  minDistance: number
  maxDistance: number

  minZoom: number
  maxZoom: number

  minPolarAngle: number
  maxPolarAngle: number

  minAzimuthAngle: number
  maxAzimuthAngle: number

  enableDamping: boolean
  dampingFactor: number

  enableZoom: boolean
  zoomSpeed: number

  enableRotate: boolean
  rotateSpeed: number

  enablePan: boolean
  panSpeed: number
  screenSpacePanning: boolean
  keyPanSpeed: number

  autoRotate: boolean
  autoRotateSpeed: number


  private target0: Vector3
  private position0: Vector3
  private zoom0: number
  private targetMin: Vector3
  private targetMax: Vector3
  private positionMin: Vector3
  private positionMax: Vector3

  // current position in spherical coordinates
  private spherical: Spherical = new Spherical()
  private sphericalDelta: Spherical = new Spherical()

  private scale: number = 1
  private panOffset: Vector3 = new Vector3()
  private zoomChanged: boolean = false

  private rotateStart = new Vector2()
  private rotateEnd = new Vector2()
  private rotateDelta = new Vector2()

  private panStart = new Vector2()
  private panEnd = new Vector2()
  private panDelta = new Vector2()

  private dollyStart = new Vector2()
  private dollyEnd = new Vector2()
  private dollyDelta = new Vector2()

  constructor(camera: Camera) {
    // Set to false to disable panning
    this.enablePan = true

    // Set to false to disable zooming
    this.enableZoom = true

    this.camera = camera
    if ((camera as PerspectiveCamera).isPerspectiveCamera) {
      this.perspCamera = camera as PerspectiveCamera
      this.orthoCamera = null
    } else if ((camera as OrthographicCamera).isOrthographicCamera) {
      this.perspCamera = null
      this.orthoCamera = camera as OrthographicCamera
    } else {
      console.warn('WARNING: Orbit Camera Controls encountered an unknown camera type - dolly/zoom disabled.')
      this.perspCamera = null
      this.orthoCamera = null
      this.enablePan = false
      this.enableZoom = false
    }

    // Set to false to disable this control
    this.enabled = true;

    // "target" sets the location of focus, where the object orbits around
    this.target = new Vector3()
    this.targetMin = new Vector3(-Infinity, -Infinity, -Infinity)
    this.targetMax = new Vector3(Infinity, Infinity, Infinity)
    this.positionMin = new Vector3(-Infinity, -Infinity, -Infinity)
    this.positionMax = new Vector3(Infinity, Infinity, Infinity)

    // How far you can dolly in and out ( PerspectiveCamera only )
    this.minDistance = 0
    this.maxDistance = Infinity

    // How far you can zoom in and out ( OrthographicCamera only )
    this.minZoom = 0
    this.maxZoom = Infinity

    // How far you can orbit vertically, upper and lower limits.
    // Range is 0 to Math.PI radians.
    this.minPolarAngle = 0  // radians
    this.maxPolarAngle = Math.PI  // radians

    // How far you can orbit horizontally, upper and lower limits.
    // If set, the interval [ min, max ] must be a sub-interval of [ - 2 PI, 2 PI ], with ( max - min < 2 PI )
    this.minAzimuthAngle = - Infinity  // radians
    this.maxAzimuthAngle = Infinity  // radians

    // Set to true to enable damping (inertia)
    // If damping is enabled, you must call controls.update() in your animation loop
    this.enableDamping = false
    this.dampingFactor = 0.05

    // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
    this.zoomSpeed = 1.0

    // Set to false to disable rotating
    this.enableRotate = true
    this.rotateSpeed = 1.0

    // Set to false to disable panning
    this.panSpeed = 1.0
    this.screenSpacePanning = true  // if false, pan orthogonal to world-space direction camera.up
    this.keyPanSpeed = 7.0 	// pixels moved per arrow key push

    // Set to true to automatically rotate around the target
    // If auto-rotate is enabled, you must call controls.update() in your animation loop
    this.autoRotate = false
    this.autoRotateSpeed = 2.0  // 30 seconds per orbit when fps is 60

    // for reset
    this.target0 = this.target.clone()
    this.position0 = camera.position.clone()
    this.zoom0 = this.getCameraZoom()

    // force an update at start
    this.update()
  }


  update(): boolean {
    const offset = new Vector3()

    // so camera.up is the orbit axis
    const quat = new Quaternion().setFromUnitVectors(this.camera.up, new Vector3(0, 1, 0))
    const quatInverse = quat.clone().invert()

    const lastPosition = new Vector3()
    const lastQuaternion = new Quaternion()

    const twoPI = 2 * Math.PI

    const position = this.camera.position

    offset.copy(position).sub(this.target)

    // rotate offset to "y-axis-is-up" space
    offset.applyQuaternion(quat)

    // angle from z-axis around y-axis
    this.spherical.setFromVector3(offset)

    if (this.autoRotate) {
      this.rotateLeft(this.getAutoRotationAngle())
    }

    if (this.enableDamping) {
      this.spherical.theta += this.sphericalDelta.theta * this.dampingFactor
      this.spherical.phi += this.sphericalDelta.phi * this.dampingFactor
    } else {
      this.spherical.theta += this.sphericalDelta.theta
      this.spherical.phi += this.sphericalDelta.phi
    }

    // restrict theta to be between desired limits

    let min = this.minAzimuthAngle
    let max = this.maxAzimuthAngle

    if (isFinite(min) && isFinite(max)) {
      if (min < - Math.PI) min += twoPI; else if (min > Math.PI) min -= twoPI
      if (max < - Math.PI) max += twoPI; else if (max > Math.PI) max -= twoPI

      if (min <= max) {
        this.spherical.theta = Math.max(min, Math.min(max, this.spherical.theta))
      } else {
        this.spherical.theta = (this.spherical.theta > (min + max) / 2) ?
          Math.max(min, this.spherical.theta) :
          Math.min(max, this.spherical.theta)
      }
    }

    // restrict phi to be between desired limits
    this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi))

    this.spherical.makeSafe()

    this.spherical.radius *= this.scale

    // restrict radius to be between desired limits
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius))

    // move target to panned location

    if (this.enableDamping === true) {
      this.target.addScaledVector(this.panOffset, this.dampingFactor)
    } else {
      this.target.add(this.panOffset)
    }
    this.target.set(
      Math.max(this.targetMin.x, Math.min(this.targetMax.x, this.target.x)),
      Math.max(this.targetMin.y, Math.min(this.targetMax.y, this.target.y)),
      Math.max(this.targetMin.z, Math.min(this.targetMax.z, this.target.z)))

    offset.setFromSpherical(this.spherical)

    // rotate offset back to "camera-up-vector-is-up" space
    offset.applyQuaternion(quatInverse)

    position.copy(this.target).add(offset)

    this.camera.lookAt(this.target)

    if (this.enableDamping === true) {
      this.sphericalDelta.theta *= (1 - this.dampingFactor)
      this.sphericalDelta.phi *= (1 - this.dampingFactor)

      this.panOffset.multiplyScalar(1 - this.dampingFactor)
    } else {
      this.sphericalDelta.set(0, 0, 0)
      this.panOffset.set(0, 0, 0)
    }

    this.scale = 1

    // update condition is:
    // min(camera displacement, camera rotation in radians)^2 > EPS
    // using small-angle approximation cos(x/2) = 1 - x^2 / 8

    if (this.zoomChanged ||
        lastPosition.distanceToSquared(this.camera.position) > EPS ||
        8 * (1 - lastQuaternion.dot(this.camera.quaternion)) > EPS) {

      lastPosition.copy(this.camera.position)
      lastQuaternion.copy(this.camera.quaternion)
      this.zoomChanged = false

      return true
    }

    return false
  }

  saveState(): void {
    this.target0.copy(this.target)
    this.position0.copy(this.camera.position)
    this.zoom0 = this.getCameraZoom()
  }

  reset(): void {
    this.target.copy(this.target0)
    this.camera.position.copy(this.position0)
    if (this.perspCamera !== null) {
      this.perspCamera.zoom = this.zoom0
      this.perspCamera.updateProjectionMatrix()
    } else if (this.orthoCamera !== null) {
      this.orthoCamera.zoom = this.zoom0
      this.orthoCamera.updateProjectionMatrix()
    }

    this.update();
  }


  lookAt(at: Vector3) {
    this.target.set(at.x, at.y, at.z)
    this.update()
  }

  positionAt(at: Vector3) {
    this.camera.position.set(at.x, at.y, at.z)
  }

  getTarget(): Vector3 {
    return new Vector3().copy(this.target)
  }

  cameraDirection(): Vector3 {
    const ret = new Vector3()
    this.camera.getWorldDirection(ret)
    return ret
  }

  setTargetBounds(min: Vector3, max: Vector3): void {
    this.targetMin.set(Math.min(min.x, max.x), Math.min(min.y, max.y), Math.min(min.z, max.z))
    this.targetMax.set(Math.max(min.x, max.x), Math.max(min.y, max.y), Math.max(min.z, max.z))
  }

  setAzimuthAngleBounds(min: number, max: number): void {
    this.minAzimuthAngle = Math.min(min, max)
    this.maxAzimuthAngle = Math.max(min, max)
  }

  setPolarAngleBounds(min: number, max: number): void {
    this.minPolarAngle = Math.max(0, Math.min(min, max))
    this.maxPolarAngle = Math.min(Math.PI, Math.max(min, max))
  }

  setZoomBounds(min: number, max: number): void {
    this.minDistance = Math.max(0, Math.min(min, max))
    this.maxDistance = Math.max(0, Math.max(min, max))
  }


  getPolarAngle(): number {
    return this.spherical.phi;
  }

  getAzimuthalAngle(): number {
    return this.spherical.theta;
  }

  getDistance(): number {
    return this.camera.position.distanceTo(this.target);
  }

  private getCameraZoom(): number {
    if (this.perspCamera !== null) {
      return this.perspCamera.zoom
    }
    if (this.orthoCamera !== null) {
      return this.orthoCamera.zoom
    }
    return 0.0
  }

  private getAutoRotationAngle(): number {
    return 2 * Math.PI / 60 / 60 * this.autoRotateSpeed
  }

  private getZoomScale() {
    return Math.pow(0.95, this.zoomSpeed)
  }

  private rotateLeft(angle: number) {
    this.sphericalDelta.theta -= angle
  }

  private rotateUp(angle: number) {
    this.sphericalDelta.phi -= angle
  }

  private panLeft(distance: number, objectMatrix: Matrix4) {
    const v = new Vector3();
    v.setFromMatrixColumn(objectMatrix, 0)  // get X column of objectMatrix
    v.multiplyScalar(- distance)
    this.panOffset.add(v)
  }

  private panUp(distance: number, objectMatrix: Matrix4) {
    const v = new Vector3()

    if (this.screenSpacePanning === true) {
      v.setFromMatrixColumn(objectMatrix, 1)
    } else {
      v.setFromMatrixColumn(objectMatrix, 0)
      v.crossVectors(this.camera.up, v)
    }

    v.multiplyScalar(distance)

    this.panOffset.add(v)
  }


  // deltaX and deltaY are in pixels; right and down are positive
  private pan(deltaX: number, deltaY: number, clientWidth: integer, clientHeight: integer) {
    const offset = new Vector3()

    if (this.perspCamera !== null) {

      // perspective
      const position = this.perspCamera.position
      offset.copy(position).sub(this.target)
      let targetDistance = offset.length()

      // half of the fov is center to top of screen
      targetDistance *= Math.tan((this.perspCamera.fov / 2) * Math.PI / 180.0)

      // we use only clientHeight here so aspect ratio does not distort speed
      this.panLeft(2 * deltaX * targetDistance / clientHeight, this.perspCamera.matrix)
      this.panUp(2 * deltaY * targetDistance / clientHeight, this.perspCamera.matrix)

    } else if (this.orthoCamera !== null) {
      // orthographic
      this.panLeft(deltaX * (this.orthoCamera.right - this.orthoCamera.left) / this.orthoCamera.zoom / clientWidth, this.orthoCamera.matrix)
      this.panUp(deltaY * (this.orthoCamera.top - this.orthoCamera.bottom) / this.orthoCamera.zoom / clientHeight, this.orthoCamera.matrix)
    }
  }



  private dollyOut(dollyScale: number) {
    if (this.perspCamera !== null) {
      this.scale /= dollyScale
    } else if (this.orthoCamera !== null) {
      this.orthoCamera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.orthoCamera.zoom * dollyScale))
      this.orthoCamera.updateProjectionMatrix()
      this.zoomChanged = true
    }
  }

  private dollyIn(dollyScale: number) {
    if (this.perspCamera !== null) {
      this.scale *= dollyScale
    } else if (this.orthoCamera !== null) {
      this.orthoCamera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.orthoCamera.zoom / dollyScale))
      this.orthoCamera.updateProjectionMatrix()
      this.zoomChanged = true
    }
  }

  //
  // Event Callbacks
  //

  // an action to start rotation.  Rotates the camera around the target
  eventRotateStart(clientX: integer, clientY: integer): void {
    this.rotateStart.set(clientX, clientY)
  }

  // continue to rotate based on the rotation start.
  eventRotateMove(clientX: integer, clientY: integer, _clientWidth: integer, clientHeight: integer): void {
    this.rotateEnd.set(clientX, clientY)
    this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed)
    this.rotateLeft(2 * Math.PI * this.rotateDelta.x / clientHeight)  // yes, height
    this.rotateUp(2 * Math.PI * this.rotateDelta.y / clientHeight)
    this.rotateStart.copy(this.rotateEnd)
    this.update()
  }

  // move the camera forward & backwards
  eventDollyStart(clientX: integer, clientY: integer): void {
    this.dollyStart.set(clientX, clientY)

  }


  eventDollyMove(clientX: integer, clientY: integer): void {
    this.dollyEnd.set(clientX, clientY)
    this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart)

    if (this.dollyDelta.y > 0) {
      this.dollyOut(this.getZoomScale())
    } else if (this.dollyDelta.y < 0) {
      this.dollyIn(this.getZoomScale())
    }

    this.dollyStart.copy(this.dollyEnd)
    this.update()
  }


  // move the camera left & right
  eventPanStart(clientX: integer, clientY: integer): void {
    this.panStart.set(clientX, clientY)

  }

  eventPanMove(clientX: integer, clientY: integer, clientWidth: integer, clientHeight: integer): void {
    this.panEnd.set(clientX, clientY)
    this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(this.panSpeed)
    this.pan(this.panDelta.x, this.panDelta.y, clientWidth, clientHeight)
    this.panStart.copy(this.panEnd)
    this.update()
  }

  eventZoom(deltaY: integer): void {
    if (deltaY < 0) {
      this.dollyIn(this.getZoomScale())
    } else if (deltaY > 0) {
      this.dollyOut(this.getZoomScale())
    }
    this.update()
  }

  eventPanUp(clientWidth: integer, clientHeight: integer): void {
    this.pan(0, this.keyPanSpeed, clientWidth, clientHeight)
    this.update()
  }

  eventPanDown(clientWidth: integer, clientHeight: integer): void {
    this.pan(0, - this.keyPanSpeed, clientWidth, clientHeight)
    this.update()
  }

  eventPanLeft(clientWidth: integer, clientHeight: integer): void {
    this.pan(this.keyPanSpeed, 0, clientWidth, clientHeight)
    this.update()
  }

  eventPanRight(clientWidth: integer, clientHeight: integer): void {
    this.pan(- this.keyPanSpeed, 0, clientWidth, clientHeight)
    this.update()
  }

  eventRotateClockwise(_clientWidth: integer, _clientHeight: integer): void {
    // TODO a better constant
    this.rotateLeft(Math.PI / -128)
  }

  eventRotateCounterClockwise(_clientWidth: integer, _clientHeight: integer): void {
    // TODO a better constant
    this.rotateLeft(Math.PI / 128)
  }

  eventRotateUp(_clientWidth: integer, _clientHeight: integer): void {
    this.rotateUp(Math.PI / 128)
  }

  eventRotateDown(_clientWidth: integer, _clientHeight: integer): void {
    this.rotateUp(Math.PI / -128)
  }
}
