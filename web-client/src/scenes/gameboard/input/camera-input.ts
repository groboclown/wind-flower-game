// Based heavily off of three.js "OrbitControls" file.
// Modified to work with phaser.js

import { CameraControl } from './camera-control'
import Phaser from 'phaser'
import { Vector2, Vector3 } from 'three'
import {
  CAMERA_POINTER_MOVED,
  CAMERA_POINTER_SELECTION,
  CAMERA_SELECTION_MOVED,
} from './events'


const STATE = {
  NONE: - 1,
  ROTATE: 0,
  DOLLY: 1,
  PAN: 2,
  DOLLY_PAN: 3,
  DOLLY_ROTATE: 4,
}
export const CAMERA_ACTIONS = {
  // "Move" are selection actions, not camera actions, but they're relative to the
  // camera direction.
  MOVE_FORWARDS: 0,
  MOVE_BACKWARDS: 1,
  MOVE_LEFT: 2,
  MOVE_RIGHT: 3,

  ZOOM_IN: 4,
  ZOOM_OUT: 5,
  PAN_UP: 6,
  PAN_DOWN: 7,
  PAN_LEFT: 8,
  PAN_RIGHT: 9,
  ROTATE_CLOCKWISE: 10,
  ROTATE_COUNTER_CLOCKWISE: 11,
  ROTATE_UP: 12,
  ROTATE_DOWN: 13,
  DRAG_DOLLY: 14,
  DRAG_ROTATE: 15,
  DRAG_PAN: 16,
  DRAG_DOLLY_ROTATE: 17,
  DRAG_DOLLY_PAN: 18,
}
interface PointerIndex {
  identifier: number,
  position: Vector2,
}

const REVERSE_VECTOR = new Vector3(-1, -1, -1)
const VERTICAL_AXIS = new Vector3(0, 1, 0)


/**
 * Controls the camera by capturing the Phaser events and translating those
 * to camera actions.
 *
 * Also, handles mapping input controls to rough grid actions by emitting these
 * events on the input event emitter.  See the events file for the details.
 */
export class CameraInput {
  private controller: CameraControl
  private state: integer
  private keyMap: {[key: string]: integer}
  private mouseButtonMap: {[key: integer]: integer}
  private touchCountMap: {[key: integer]: integer}
  private activePointers: Array<PointerIndex>
  private keyboardDown: {
    left: boolean, right :boolean, up: boolean, down: boolean,
    clockwise: boolean, counterClockwise: boolean, rotUp: boolean, rotDown: boolean,
    in: boolean, out: boolean,
  }
  private dom: HTMLCanvasElement | null
  private eventDispatch: Phaser.Events.EventEmitter | null
  private dragActive: boolean

  constructor(controller: CameraControl) {
    this.controller = controller
    this.state = STATE.NONE
    this.dragActive = false

    this.keyMap = {
      'ArrowLeft': CAMERA_ACTIONS.ROTATE_COUNTER_CLOCKWISE,
      'ArrowRight': CAMERA_ACTIONS.ROTATE_CLOCKWISE,
      'ArrowUp': CAMERA_ACTIONS.ZOOM_IN,
      'ArrowDown': CAMERA_ACTIONS.ZOOM_OUT,
      'KeyW': CAMERA_ACTIONS.MOVE_FORWARDS,
      'KeyA': CAMERA_ACTIONS.MOVE_LEFT,
      'KeyS': CAMERA_ACTIONS.MOVE_BACKWARDS,
      'KeyD': CAMERA_ACTIONS.MOVE_RIGHT,
      "KeyI": CAMERA_ACTIONS.ROTATE_UP,
      "KeyJ": CAMERA_ACTIONS.ROTATE_COUNTER_CLOCKWISE,
      "KeyK": CAMERA_ACTIONS.ROTATE_DOWN,
      "KeyL": CAMERA_ACTIONS.ROTATE_CLOCKWISE,
    }
    this.mouseButtonMap = {
      0: CAMERA_ACTIONS.DRAG_ROTATE,
      1: CAMERA_ACTIONS.DRAG_DOLLY,
      2: CAMERA_ACTIONS.DRAG_PAN,
    }
    this.touchCountMap = {
      1: CAMERA_ACTIONS.DRAG_PAN,

      // Pinch-zoom + rotate
      2: CAMERA_ACTIONS.DRAG_DOLLY_ROTATE,
    }

    this.dom = null
    this.eventDispatch = null
    this.activePointers = []
    //this.focusedTile = new Vector2(0, 0)
    this.keyboardDown = {
      up: false, down: false, left: false, right: false,
      clockwise: false, counterClockwise: false, rotUp: false, rotDown: false,
      in: false, out: false
    }
  }

  // Connects most input events to the controller.
  //   The scene update must first call the input controller,
  //   which will perform additional input checks.
  connectInput(input: Phaser.Input.InputPlugin) {
    const self = this
    self.dom = input.scene.game.canvas
    self.eventDispatch = input

    // We need at least 3 touch inputs, if touch is supported.
    while (input.pointer3 === undefined) {
      input.addPointer()
    }

    // Allow right-click
    //   This allows pointer.rightButtonDown() ahd rightButtonReleased() to work.
    //      There's also middleButtonDown(), leftButtonDown(), backButtonDown(), and forwardButtonDown()
    //
    input.mouse.disableContextMenu()

    input.on(
      Phaser.Input.Events.POINTER_DOWN,
      // Not listed: currentlyOver, which is the list of game objects the pointer is over.
      (pointer: Phaser.Input.Pointer) => { self.onPointerDown(pointer) })
    input.on(
      Phaser.Input.Events.POINTER_UP,
      // Not listed: currentlyOver, which is the list of game objects the pointer is over.
      (pointer: Phaser.Input.Pointer) => { self.onPointerUp(pointer) })
    input.on(
      Phaser.Input.Events.POINTER_MOVE,
      // Not listed: currentlyOver, which is the list of game objects the pointer is over.
      (pointer: Phaser.Input.Pointer) => { self.onPointerMove(pointer) })
    input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_p: Phaser.Input.Pointer, _o: Array<any>, dx: number, dy: number, dz: number) => { self.onWheel(dx, dy, dz) })
    input.keyboard.on(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      (keyEvent: KeyboardEvent) => { self.onKeyDown(keyEvent) })
    input.keyboard.on(
      Phaser.Input.Keyboard.Events.ANY_KEY_UP,
      (keyEvent: KeyboardEvent) => { self.onKeyUp(keyEvent) })
  }

  clearState() {
    this.state = STATE.NONE
  }

  lookAt(at: THREE.Vector3) {
    this.controller.lookAt(at)
  }

  positionAt(at: THREE.Vector3) {
    this.controller.positionAt(at)
  }

  getTarget(): THREE.Vector3 {
    return this.controller.getTarget()
  }

  setTargetBounds(min: THREE.Vector3, max: THREE.Vector3) {
    this.controller.setTargetBounds(min, max)
  }

  setAzimuthAngleBounds(min: number, max: number) {
    this.controller.setAzimuthAngleBounds(min, max)
  }

  setPolarAngleBounds(min: number, max: number) {
    this.controller.setPolarAngleBounds(min, max)
  }

  setZoomBounds(min: number, max: number) {
    this.controller.setZoomBounds(min, max)
  }

  onUpdate() {
    if (this.dom) {
      // Key held down that causes continuous camera action.
      if (this.keyboardDown.left) {
        this.controller.eventPanLeft(this.dom.width, this.dom.height)
      }
      if (this.keyboardDown.right) {
        this.controller.eventPanRight(this.dom.width, this.dom.height)
      }
      if (this.keyboardDown.up) {
        this.controller.eventPanUp(this.dom.width, this.dom.height)
      }
      if (this.keyboardDown.down) {
        this.controller.eventPanDown(this.dom.width, this.dom.height)
      }
      if (this.keyboardDown.in) {
        // TODO is this right?
        this.controller.eventZoom(-1)
      }
      if (this.keyboardDown.out) {
        // TODO is this right?
        this.controller.eventZoom(1)
      }
      if (this.keyboardDown.clockwise) {
        this.controller.eventRotateClockwise(this.dom.width, this.dom.height)
      }
      if (this.keyboardDown.counterClockwise) {
        this.controller.eventRotateCounterClockwise(this.dom.width, this.dom.height)
      }
      if (this.keyboardDown.rotUp) {
        this.controller.eventRotateUp(this.dom.width, this.dom.height)
      }
      if (this.keyboardDown.rotDown) {
        this.controller.eventRotateDown(this.dom.width, this.dom.height)
      }
    }
    this.controller.update()
  }


  // ------------------------------------------------------------------------
  // Input Handlers


  private onPointerDown(pointer: Phaser.Input.Pointer) {
    // Reset the drag action.
    this.dragActive = false

    // Record an active pointer.
    this.activePointers.push({
      identifier: pointer.identifier,
      position: new Vector2(pointer.x, pointer.y),
    })

    const avgPos = this.avgDownPointerPosition()
    const action = pointer.wasTouch
      ? this.touchCountMap[this.activePointers.length]
      : this.mouseButtonMap[pointer.button]
    switch (action) {
      case CAMERA_ACTIONS.DRAG_PAN:
        this.state = STATE.PAN
        this.controller.eventPanStart(avgPos.x, avgPos.y)
        break
      case CAMERA_ACTIONS.DRAG_ROTATE:
        this.state = STATE.ROTATE
        this.controller.eventRotateStart(avgPos.x, avgPos.y)
        break
      case CAMERA_ACTIONS.DRAG_DOLLY:
        this.state = STATE.DOLLY
        this.controller.eventDollyStart(avgPos.x, avgPos.y)
        break
      case CAMERA_ACTIONS.DRAG_DOLLY_PAN:
        this.state = STATE.DOLLY_PAN
        this.controller.eventDollyStart(avgPos.x, avgPos.y)
        this.controller.eventPanStart(avgPos.x, avgPos.y)
        break
      case CAMERA_ACTIONS.DRAG_DOLLY_ROTATE:
        this.state = STATE.DOLLY_ROTATE
        this.controller.eventDollyStart(avgPos.x, avgPos.y)
        this.controller.eventRotateStart(avgPos.x, avgPos.y)
        break
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    this.state = STATE.NONE
    if (! this.dragActive && this.eventDispatch && this.dom) {
      // Possibly a selection event; a drag never occurred with this down action.
      const x = (pointer.position.x / this.dom.width) * 2 - 1
      const y = 1 - ((pointer.position.y / this.dom.height) * 2)
      this.eventDispatch?.emit(CAMERA_POINTER_SELECTION, x, y)
    }
    this.dragActive = false
    this.activePointers = this.activePointers.filter((ptr) => pointer.identifier !== ptr.identifier)
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (this.eventDispatch && this.dom) {
      // Note: NOT the average position.  If there's no pointer
      // down, then that will be meaningless.
      const x = (pointer.position.x / this.dom.width) * 2 - 1
      const y = 1 - ((pointer.position.y / this.dom.height) * 2)
      this.eventDispatch.emit(CAMERA_POINTER_MOVED, x, y)
    }

    this.activePointers.forEach((ptr) => {
      if (ptr.identifier === pointer.identifier) {
        ptr.position.set(pointer.x, pointer.y)
      }
    })
    const avgPos = this.avgDownPointerPosition()
    switch (this.state) {
      case STATE.DOLLY:
        this.dragActive = true
        this.controller.eventDollyMove(avgPos.x, avgPos.y)
        break
      case STATE.PAN:
        this.dragActive = true
        if (this.dom !== null) {
          this.controller.eventPanMove(avgPos.x, avgPos.y, this.dom.width, this.dom.height)
        }
        break
      case STATE.ROTATE:
        this.dragActive = true
        if (this.dom !== null) {
          this.controller.eventRotateMove(avgPos.x, avgPos.y, this.dom.width, this.dom.height)
        }
        break
      case STATE.DOLLY_PAN:
        this.dragActive = true
        this.controller.eventDollyMove(avgPos.x, avgPos.y)
        if (this.dom !== null) {
          this.controller.eventPanMove(avgPos.x, avgPos.y, this.dom.width, this.dom.height)
        }
        break
      case STATE.DOLLY_ROTATE:
        this.dragActive = true
        this.controller.eventDollyMove(avgPos.x, avgPos.y)
        if (this.dom !== null) {
          this.controller.eventRotateMove(avgPos.x, avgPos.y, this.dom.width, this.dom.height)
        }
        break
    }
  }

  private onWheel(deltaX: number, deltaY: number, _deltaZ: number) {
    // Wheel is hard-coded to be dolly along the Y axis, and undefined
    // for any other axis.
    this.controller.eventDollyStart(0, 0)
    this.controller.eventDollyMove(deltaX, deltaY)
  }

  private onKeyDown(keyEvent: KeyboardEvent) {
    console.log(`Key: ${keyEvent.key}; code: ${keyEvent.code};`)
    let action = this.keyMap[keyEvent.code]
    switch (action) {
      // The MOVE_* actions need to compute the direction on the grid
      // relative to the direction the camera is pointing.
      // Probably should call an event or something that will contain the
      // direction vector to enable proper highlighting.
      case CAMERA_ACTIONS.MOVE_FORWARDS:
        this.eventDispatch?.emit(CAMERA_SELECTION_MOVED, this.controller.cameraDirection())
        break
      case CAMERA_ACTIONS.MOVE_BACKWARDS:
        this.eventDispatch?.emit(CAMERA_SELECTION_MOVED, this.controller.cameraDirection().multiply(REVERSE_VECTOR))
        break
      case CAMERA_ACTIONS.MOVE_LEFT:
        this.eventDispatch?.emit(CAMERA_SELECTION_MOVED, this.controller.cameraDirection().applyAxisAngle(VERTICAL_AXIS, -Math.PI / 2))
        break
      case CAMERA_ACTIONS.MOVE_RIGHT:
        this.eventDispatch?.emit(CAMERA_SELECTION_MOVED, this.controller.cameraDirection().applyAxisAngle(VERTICAL_AXIS, Math.PI / 2))
        break
      case CAMERA_ACTIONS.ROTATE_CLOCKWISE:
        this.keyboardDown.clockwise = true
        break
      case CAMERA_ACTIONS.ROTATE_COUNTER_CLOCKWISE:
        this.keyboardDown.counterClockwise = true
        break
      case CAMERA_ACTIONS.ROTATE_UP:
        this.keyboardDown.rotUp = true
        break
      case CAMERA_ACTIONS.ROTATE_DOWN:
        this.keyboardDown.rotDown = true
        break
      case CAMERA_ACTIONS.PAN_LEFT:
        this.keyboardDown.left = true
        break
      case CAMERA_ACTIONS.PAN_RIGHT:
        this.keyboardDown.right = true
        break
      case CAMERA_ACTIONS.PAN_UP:
        this.keyboardDown.up = true
        break
      case CAMERA_ACTIONS.PAN_DOWN:
        this.keyboardDown.down = true
        break
      case CAMERA_ACTIONS.ZOOM_IN:
        this.keyboardDown.in = true
        break
      case CAMERA_ACTIONS.ZOOM_OUT:
        this.keyboardDown.out = true
        break
    }
  }

  private onKeyUp(keyEvent: KeyboardEvent) {
    let action = this.keyMap[keyEvent.code]
    switch (action) {
      case CAMERA_ACTIONS.ROTATE_CLOCKWISE:
        this.keyboardDown.clockwise = false
        break
      case CAMERA_ACTIONS.ROTATE_COUNTER_CLOCKWISE:
        this.keyboardDown.counterClockwise = false
        break
      case CAMERA_ACTIONS.ROTATE_UP:
        this.keyboardDown.rotUp = false
        break
      case CAMERA_ACTIONS.ROTATE_DOWN:
        this.keyboardDown.rotDown = false
        break
      case CAMERA_ACTIONS.PAN_LEFT:
        this.keyboardDown.left = false
        break
      case CAMERA_ACTIONS.PAN_RIGHT:
        this.keyboardDown.right = false
        break
      case CAMERA_ACTIONS.PAN_UP:
        this.keyboardDown.up = false
        break
      case CAMERA_ACTIONS.PAN_DOWN:
        this.keyboardDown.down = false
        break
      case CAMERA_ACTIONS.ZOOM_IN:
        this.keyboardDown.in = false
        break
      case CAMERA_ACTIONS.ZOOM_OUT:
        this.keyboardDown.out = false
        break
    }
  }


  // ------------------------------------------------------------------------
  // Utility Functions

  private avgDownPointerPosition(): Vector2 {
    let sum = new Vector2(0, 0)
    let len = this.activePointers.length
    if (len > 0) {
      this.activePointers.forEach((ptr) => {
        sum.add(ptr.position)
      })
      sum.divideScalar(this.activePointers.length)
    }
    return sum
  }

}
