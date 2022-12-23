// Actions caused by user interface "settings" options.
import { createAction } from '@reduxjs/toolkit'


export interface UserPreferences {
  humanName: string
  gameName: string
  tileTheme: string
  visibleWidth: integer
  visibleHeight: integer
}


export const updatedUserPreferences = createAction(
  'UserPreferences/updated', function prepare(info: UserPreferences) {
    return { payload: info }
  },
)


export interface VolumePreferences {
  master: number
  music: number
  effects: number
}


export const updatedVolumePreferences = createAction(
  'VolumePreferences/updated', function prepare(info: VolumePreferences) {
    return { payload: info }
  },
)
