// Client-Server API.
import { JsonLookup, JSONValueType } from '../lib/typed-json'
import { Account, SegmentTile, ServerParameters, ActiveGamePlayer, GameParameters } from './structs'


// RestApiConnection generic API for connecting to the server.
export interface RestApiConnection {
  // setServerPublicKey called based on parameters embedded in the HTML
  //   Because it's embedded in the HTML, that means it came from the server.
  setServerPublicKey(key: string): void

  // setAccountConnectionInformation set how the connection will mark the authorization information
  //   Either set based on cached client information or on create account requests.
  setAccountConnectionInformation(accountId: string, accountPrivateKey: string): void

  getJson(path: string, parameters: JSONValueType): Promise<JsonLookup>
  postJson(path: string, parameters: JSONValueType): Promise<JsonLookup>
}


// HostAPI knows the API formats
export class HostApi {
  private connection: RestApiConnection

  constructor(
    connection: RestApiConnection,
  ) {
    this.connection = connection
  }

  // createAccount request a new account from the server
  async createAccount(): Promise<Account> {
    const data = await this.connection.postJson('/account', {})
    const accountId = data.asStr('accountId')
    const publicKey = data.asStr('publicKey')
    const privateKey = data.asStr('privateKey')
    if (
      accountId !== null
      && publicKey !== null
      && privateKey !== null
    ) {
      return {
        accountId,
        publicKey,
        privateKey,
      }
    }
    return Promise.reject('unexpected server response for account creation')
  }


  async getServerParameters(): Promise<ServerParameters> {
    const data = await this.connection.getJson('/server/parameters', {})
    const maximumTileWidth = data.asInt('maximumTileWidth')
    const maximumTileHeight = data.asInt('maximumTileHeight')
    if (
      maximumTileWidth !== null
      && maximumTileHeight !== null
    ) {
      return {
        maximumTileWidth,
        maximumTileHeight,
      }
    }
    return Promise.reject('unexpected server response for server parameters')
  }


  // startGameLobby start a new game lobby
  // Returns the game ID for the new game.
  async startGameLobby(name: string, maxPlayers: integer): Promise<string> {
    const data = await this.connection.postJson('/game', {name, maxPlayers})
    const gameId = data.asStr('gameId')
    if (gameId !== null) {
      return gameId
    }
    return Promise.reject('unexpected server response for server parameters')
  }


  async getGameParameters(gameId: string): Promise<GameParameters> {
    const data = await this.connection.getJson(`/game/${gameId}`, {})
    const currentBoardWidth = data.asInt('currentBoardWidth')
    const currentBoardHeight = data.asInt('currentBoardHeight')
    const runState = data.asStr('runState')
    const currentPlayerTurn = data.asInt('currentPlayerTurn')

    const players: ActiveGamePlayer[] = []
    for (let i = 0; i < data.getLength('players'); i++) {
      const playerIndex = data.asInt('players', i, 'playerIndex')
      const publicName = data.asStr('publicName', i, 'publicName')
      if (playerIndex !== null && publicName !== null) {
        players.push({ playerIndex, publicName })
      }
    }
    if (
        currentBoardWidth !== null
        && currentBoardHeight !== null
        && runState !== null
        && currentPlayerTurn !== null
    ) {
      return {
        currentBoardWidth,
        currentBoardHeight,
        runState,
        currentPlayerTurn,
        players,
      }
    }
    return Promise.reject('unexpected server response for server parameters')
  }


  // loadSegment load a game board segment at the x, y corner
  // Up to the maximum returned.
  async loadSegment(
    gameId: string,
    x: integer,
    y: integer,
    width: integer,
    height: integer,
  ): Promise<SegmentTile[]> {
    const data = await this.connection.getJson(`/game/${gameId}/segment`, {x, y, width, height})
    const segmentCount = data.asInt('count')
    if (segmentCount === null) {
      return Promise.reject('unexpected server response for load segment')
    }
    const ret = new Array<SegmentTile>(segmentCount)
    for (let i = 0; i < segmentCount; i++) {
      // This is fairly inefficient.
      // Could instead trust the server and just assign it as-is.
      const posX = data.asInt('segments', i, 'x')
      const posY = data.asInt('segments', i, 'y')
      const height = data.asNumber('segments', i, 'h')
      const category = data.asStr('segments', i, 'c')
      const tokenId = data.asInt('segments', i, 't')
      const paramCount = data.getLength('segments', i, 'p')
      const params = new Array<{i: integer, q: number}>(Math.max(0, paramCount))
      for (let j = 0; j < paramCount; j++) {
        const pIndex = data.asInt('segments', i, 'p', j, 'i')
        const pQuantity = data.asNumber('segments', i, 'p', j, 'q')
        if (pIndex === null || pQuantity === null) {
          return Promise.reject('unexpected server response for load segment')
        }
        params[j] = {i: pIndex, q: pQuantity}
      }
      if (posX !== null && posY !== null && height !== null && category !== null && tokenId !== null) {
        ret[i] = {
          x: posX, y: posY, h: height, c: category, t: tokenId, p: params,
        }
      }
    }
    return ret
  }
}
