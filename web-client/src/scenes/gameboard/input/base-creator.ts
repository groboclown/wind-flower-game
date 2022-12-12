// Creates the input + camera controller for the scene.
import { Scene3D } from '@enable3d/phaser-extension'
import { CameraInput } from './camera-input'
import { OrbitCameraControl } from './orbit-camera-control'


export function createCameraInputControls(scene: Scene3D): CameraInput {
  // return new OrbitControlsWrapper(scene)
  const controller = new OrbitCameraControl(scene.third.camera)
  const ret = new CameraInput(controller)
  ret.connectInput(scene.input)
  return ret
}
