// Client-Server API.
import { JsonLookup, JSONValueType } from '../lib/typed-json'
import {
  NewAccount,
  ServerParameters,
  SegmentTileCollection,
  GameParameters,
  GameLobbyCreated,
} from './structs'
import {
  ParsedValue,
  parseNewAccount,
  parseGameLobbyCreated,
  parseServerParameters,
  parseGameParameters,
  parseSegmentTileCollection,
} from './response-parsers'


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
  async createAccount(): Promise<NewAccount> {
    const data = await this.connection.postJson('/account', {})
    return await asType('create account', parseNewAccount(data))
  }


  async getServerParameters(): Promise<ServerParameters> {
    const data = await this.connection.getJson('/server/parameters', {})
    return await asType('fetch server information', parseServerParameters(data))
  }


  // startGameLobby start a new game lobby
  async startGameLobby(name: string, maxPlayers: integer): Promise<GameLobbyCreated> {
    const data = await this.connection.postJson('/game', {name, maxPlayers})
    return await asType('start a game lobby', parseGameLobbyCreated(data))
  }


  async getGameParameters(gameId: string): Promise<GameParameters> {
    const data = await this.connection.getJson(`/game/${gameId}`, {})
    return await asType('get game information', parseGameParameters(data))
  }


  // loadSegment load a game board segment at the x, y corner
  // Up to the maximum returned.
  async loadSegment(
    gameId: string,
    x: integer,
    y: integer,
    width: integer,
    height: integer,
  ): Promise<SegmentTileCollection> {
    const data = await this.connection.getJson(`/game/${gameId}/segment`, {x, y, width, height})
    return await asType('load segments', parseSegmentTileCollection(data))
  }
}


async function asType<Type>(req: string, value: ParsedValue<Type>): Promise<Type> {
  if (value.parsed !== undefined) {
    return value.parsed
  }
  return Promise.reject(`unexpected server response to ${req}: ${value.problems}`)
}
