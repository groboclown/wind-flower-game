// New events emitted by the input.

// All x, y screen coordinates are altered to be in the range [-1, 1] within the
// game canvas.  This allows the camera ray caster to work correctly.

// Emitted when a pointer moves on the screen.
//    arguments: x: number, y: number
export const CAMERA_POINTER_MOVED = 'camera-pointer-moved'

// Emitted when the user performs a "selection" on a position on the screen
// (such as a mouse click).
//    arguments: x: number, y: number
export const CAMERA_POINTER_SELECTION = 'camera-pointer-selection'

// Emitted when the user chooses to move the active selection relative to the camera.
// (such as tapping the left arrow key).  The returned value is a vector of the
// direction based on the current camera position.
//    arguments: vector: Vector3
export const CAMERA_SELECTION_MOVED = 'camera-selection-moved'
