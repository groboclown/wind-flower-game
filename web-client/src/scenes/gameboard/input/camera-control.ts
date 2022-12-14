import { THREE } from '@enable3d/phaser-extension'

export interface CameraControl {
  update(): boolean
  saveState(): void
  reset(): void
  lookAt(at: THREE.Vector3): void
  positionAt(at: THREE.Vector3): void
  cameraDirection(): THREE.Vector3
  getTarget(): THREE.Vector3
  setTargetBounds(min: THREE.Vector3, max: THREE.Vector3): void
  setAzimuthAngleBounds(min: number, max: number): void
  setPolarAngleBounds(min: number, max: number): void
  setZoomBounds(min: number, max: number): void

  eventRotateStart(clientX: integer, clientY: integer): void
  eventRotateMove(clientX: integer, clientY: integer, clientWidth: integer, clientHeight: integer): void
  eventDollyStart(clientX: integer, clientY: integer): void
  eventDollyMove(clientX: integer, clientY: integer): void
  eventPanStart(clientX: integer, clientY: integer): void
  eventPanMove(clientX: integer, clientY: integer, clientWidth: integer, clientHeight: integer): void
  eventZoom(deltaY: integer): void

  // keyboard inputs
  eventPanUp(clientWidth: integer, clientHeight: integer): void
  eventPanDown(clientWidth: integer, clientHeight: integer): void
  eventPanLeft(clientWidth: integer, clientHeight: integer): void
  eventPanRight(clientWidth: integer, clientHeight: integer): void
  eventRotateClockwise(clientWidth: integer, clientHeight: integer): void
  eventRotateCounterClockwise(clientWidth: integer, clientHeight: integer): void
  eventRotateUp(clientWidth: integer, clientHeight: integer): void
  eventRotateDown(clientWidth: integer, clientHeight: integer): void
}
