// Based heavily off of three.js "OrbitControls" file.
// Modified to work with phaser.js

import { Vector2 } from 'three';
import { CameraControl } from './camera-control'
import Phaser from 'phaser'


const STATE = {
  NONE: - 1,
  ROTATE: 0,
  DOLLY: 1,
  PAN: 2,
  TOUCH_ROTATE: 3,
  TOUCH_PAN: 4,
  TOUCH_DOLLY: 5,
  TOUCH_DOLLY_PAN: 6,
  TOUCH_DOLLY_ROTATE: 7,
}
const CAMERA_ACTIONS = {
  MOVE_UP: 0,
  MOVE_DOWN: 1,
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
  DRAG_DOLLY: 12,
  DRAG_ROTATE: 13,
  DRAG_PAN: 14,
  DRAG_DOLLY_ROTATE: 15,
  DRAG_DOLLY_PAN: 16,
}


export class CameraInput {
  private controller: CameraControl
  private state: integer
  private keyMap: {[key: string]: integer}
  private mouseButtonMap: {[key: integer]: integer}
  private touchCountMap: {[key: integer]: integer}
  private dom: HTMLElement | null
  private activePointers: Array<number>
  //private focusedTile: Vector2
  private keyboardPan: Vector2
  //private keyboardZoom: number

  constructor(controller: CameraControl) {
    this.controller = controller
    this.state = STATE.NONE

    this.keyMap = {
      'ArrowLeft': CAMERA_ACTIONS.ROTATE_CLOCKWISE,
      'ArrowRight': CAMERA_ACTIONS.ROTATE_COUNTER_CLOCKWISE,
      'ArrowUp': CAMERA_ACTIONS.ZOOM_IN,
      'ArrowDown': CAMERA_ACTIONS.ZOOM_OUT,
      'W': CAMERA_ACTIONS.MOVE_UP,
      'A': CAMERA_ACTIONS.MOVE_LEFT,
      'S': CAMERA_ACTIONS.MOVE_DOWN,
      'D': CAMERA_ACTIONS.MOVE_RIGHT,
    }
    this.mouseButtonMap = {
      0: CAMERA_ACTIONS.DRAG_ROTATE,
      1: CAMERA_ACTIONS.DRAG_PAN,
      2: CAMERA_ACTIONS.DRAG_DOLLY,
    }
    this.touchCountMap = {
      1: CAMERA_ACTIONS.DRAG_PAN,

      // Pinch-zoom + rotate
      2: CAMERA_ACTIONS.DRAG_DOLLY_ROTATE,
    }

    this.dom = null
    this.activePointers = []
    //this.focusedTile = new Vector2(0, 0)
    this.keyboardPan = new Vector2(0, 0)
    //this.keyboardZoom = 0
  }

  // Connects most input events to the controller.
  //   The scene update must first call the input controller,
  //   which will perform additional input checks.
  connectInput(input: Phaser.Input.InputPlugin) {
    const self = this
    self.dom = input.scene.game.canvas

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
    // TODO use keyboardPan and keyboardZoom to continue updating controller
    this.controller.update()
  }


  // ------------------------------------------------------------------------
  // Input Handlers


  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (pointer.wasTouch) {
      // onTouchStart
      this.activePointers.push(pointer.identifier)
      switch (this.touchCountMap[this.activePointers.length]) {
        case CAMERA_ACTIONS.DRAG_PAN:
          this.state = STATE.TOUCH_PAN
          // FIXME
          break
        case CAMERA_ACTIONS.DRAG_ROTATE:
          this.state = STATE.TOUCH_ROTATE
          // FIXME
          break
        case CAMERA_ACTIONS.DRAG_DOLLY:
          this.state = STATE.TOUCH_DOLLY
          // FIXME
          break
        case CAMERA_ACTIONS.DRAG_DOLLY_PAN:
          this.state = STATE.TOUCH_DOLLY_PAN
          // FIXME
          break
        case CAMERA_ACTIONS.DRAG_DOLLY_ROTATE:
          this.state = STATE.TOUCH_DOLLY_ROTATE
          // FIXME
          break
      }
    } else {
      // onMouseDown
      switch (this.mouseButtonMap[pointer.button]) {
        case CAMERA_ACTIONS.DRAG_PAN:
          this.state = STATE.PAN
          this.controller.eventPanStart(pointer.x, pointer.y)
          break
        case CAMERA_ACTIONS.DRAG_ROTATE:
          this.state = STATE.ROTATE
          this.controller.eventRotateStart(pointer.x, pointer.y)
          break
        case CAMERA_ACTIONS.DRAG_DOLLY:
          this.state = STATE.DOLLY
          this.controller.eventDollyStart(pointer.x, pointer.y)
          break
      }
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    this.state = STATE.NONE
    if (pointer.wasTouch) {
      this.activePointers = this.activePointers.filter((num) => pointer.identifier !== num)
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    switch (this.state) {
      case STATE.DOLLY:
        this.controller.eventDollyMove(pointer.x, pointer.y)
        break
      case STATE.PAN:
        if (this.dom !== null) {
          this.controller.eventPanMove(pointer.x, pointer.y, this.dom.clientWidth, this.dom.clientHeight)
        }
        break
      case STATE.ROTATE:
        if (this.dom !== null) {
          this.controller.eventRotateMove(pointer.x, pointer.y, this.dom.clientWidth, this.dom.clientHeight)
        }
        break
      case STATE.TOUCH_DOLLY:
        // FIXME
        break
      case STATE.TOUCH_PAN:
        // FIXME
        break
      case STATE.TOUCH_ROTATE:
        // FIXME
        break
      case STATE.TOUCH_DOLLY_PAN:
        // FIXME
        break
      case STATE.TOUCH_DOLLY_ROTATE:
        // FIXME
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
    let action = this.keyMap[keyEvent.code]
    switch (action) {
      case CAMERA_ACTIONS.MOVE_UP:
        // TODO
        break
      case CAMERA_ACTIONS.MOVE_DOWN:
        // TODO
        break
      case CAMERA_ACTIONS.MOVE_LEFT:
        // TODO
        break
      case CAMERA_ACTIONS.MOVE_RIGHT:
        // TODO
        break
      case CAMERA_ACTIONS.PAN_LEFT:
        this.keyboardPan.setX(-1)
        break
      case CAMERA_ACTIONS.PAN_RIGHT:
        this.keyboardPan.setX(1)
        break
      case CAMERA_ACTIONS.PAN_UP:
        this.keyboardPan.setY(-1)
        break
      case CAMERA_ACTIONS.PAN_DOWN:
        this.keyboardPan.setY(1)
        break
      case CAMERA_ACTIONS.ZOOM_IN:
        //this.keyboardZoom = -1
        break
      case CAMERA_ACTIONS.ZOOM_OUT:
        //this.keyboardZoom = 1
        break
    }
  }

  private onKeyUp(keyEvent: KeyboardEvent) {
    let action = this.keyMap[keyEvent.code]
    switch (action) {
      case CAMERA_ACTIONS.PAN_LEFT:
      case CAMERA_ACTIONS.PAN_RIGHT:
        this.keyboardPan.setX(0)
        break
      case CAMERA_ACTIONS.PAN_UP:
      case CAMERA_ACTIONS.PAN_DOWN:
        this.keyboardPan.setY(0)
        break
      case CAMERA_ACTIONS.ZOOM_IN:
      case CAMERA_ACTIONS.ZOOM_OUT:
        //this.keyboardZoom = 0
        break
      }
  }


  // ------------------------------------------------------------------------
  //

}
