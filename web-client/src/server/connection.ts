// Maintain a static connection to the server.
import { RestApiConnection } from './api'


let serverConnection: RestApiConnection | null = null


export function initializeServer(apiUrl: string) {
  throw new Error('server connection not supported yet')
}

export function closeServer() {
  serverConnection = null
}

export function initializeSinglePlayerServer(server: RestApiConnection) {
  serverConnection = server
}

export function getRestApiConnection(): RestApiConnection {
  if (serverConnection === null) {
    throw new Error('Not connected to a server')
  }
  return serverConnection
}
