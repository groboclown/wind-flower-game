// Actions caused by loading data from the client database stores.
import { createAction } from '@reduxjs/toolkit'


export interface ClientAccount {
  humanName: string
  loginId: string
  privateKey: string
  publicKey: string
  locale: string
  localTz: string
  exists: boolean
}


export const loadedClientAccount = createAction(
  'ClientAccount/loaded', function prepare(info: ClientAccount) {
    return { payload: info }
  },
)


export interface ServerInfo {
  serverName: string
  publicKey: string
}


export const loadedServer = createAction(
  'Server/loaded', function prepare(info: ServerInfo) {
    return { payload: info }
  },
)
