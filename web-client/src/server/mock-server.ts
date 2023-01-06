// Mock implementation of the server
import { JSONValueType } from '../lib/typed-json'
import {
  EncryptionKey,
  generateKeyPair,
  generateEncryptionKeyFrom,
  createSignature,
  verifySignature,
} from '../lib/crypto'
import { RestApiConnection } from './api'
import {
  ServerConnection,
  ServerRestApiConnection,
  Response,
  SIG_HASH_ALGORITHM
} from './server-connection'
import {
  NewAccount,
  ServerParameters,
  SegmentTileCollection,
  GameParameters,
  GameLobbyCreated,
} from './structs'


export class ServerError extends Error {
  readonly code: integer
  readonly reason: string

  constructor(code: integer, reason: string, message: string) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.reason = reason
  }
}


const TOKEN_TIMEOUT_SECONDS = 60


// AccountMananger for simulating pre-existing accounts
export interface ExistingAccountSimulator {
  simulateAccount(accountId: string, publicKey: string): Promise<void>
}


// AccountMananger for creating and removing accounts
export interface AccountMananger {
  hasAccount(accountId: string): Promise<boolean>
  createAccount(): Promise<{ accountId: string, publicKey: string, privateKey: string}>
  removeAccount(accountId: string): Promise<void>
}


// MockServer provides functionality for receiving in-client requests and responding like a server.
export interface MockServer {
  // setAccountManager called during setup, to initialize the server with an account database
  //    The request validation is done by the wrapping object.
  setAccountManager(accountManager: AccountMananger): Promise<void>

  handleCreateAccount(): Promise<NewAccount>
  handleGetServerParameters(requestor: AccountInfo): Promise<ServerParameters>
  handleStartGameLobby(
    requestor: AccountInfo, name: string, maxPlayers: integer
  ): Promise<GameLobbyCreated>
  handleGetGameParameters(requestor: AccountInfo, gameId: string): Promise<GameParameters>
  handleLoadSegment(
    requestor: AccountInfo,
    gameId: string,
    x: integer,
    y: integer,
    width: integer,
    height: integer,
  ): Promise<SegmentTileCollection>
}


export interface MockServerSetup {
  readonly serverPublicKey: string
  readonly accountSimulator: ExistingAccountSimulator
  readonly connection: RestApiConnection
}


export async function createMockServerSetup(
  baseUrl: string,
  server: MockServer,
): Promise<MockServerSetup> {
  const serverKeyPair = await generateKeyPair('')
  const serverPrivateKey = await generateEncryptionKeyFrom(serverKeyPair.privatePEM, '')
  const mock = new MockServerConnection(server, serverPrivateKey, baseUrl)
  await server.setAccountManager(mock.accountManager)
  const conn = new ServerRestApiConnection(mock, baseUrl)
  return {
    accountSimulator: mock.accountManager,
    serverPublicKey: serverKeyPair.publicPEM,
    connection: conn,
  }
}


const UTF8_ENCODER = new TextEncoder()


export interface AccountInfo {
  accountId: string
  accountPublicKey: EncryptionKey
}


class AccountManangerImpl implements AccountMananger, ExistingAccountSimulator {
  private accounts: {[keys: string]: AccountInfo }

  constructor() {
    this.accounts = {}
  }

  async simulateAccount(accountId: string, publicKey: string): Promise<void> {
    if (this.accounts[accountId] !== undefined) {
      throw new Error(`account ${accountId} already exists`)
    }
    this.accounts[accountId] = {
      accountId,
      accountPublicKey: await generateEncryptionKeyFrom(publicKey),
    }
  }

  async hasAccount(accountId: string): Promise<boolean> {
    return this.accounts[accountId] !== undefined
  }

  async createAccount(): Promise<{ accountId: string, publicKey: string, privateKey: string}> {
    // Awaits all come first.
    const keyPair = await generateKeyPair('')
    const accountPublicKey = await generateEncryptionKeyFrom(keyPair.publicPEM)

    const accountId = `acc-${Object.keys(this.accounts).length}`
    this.accounts[accountId] = {
      accountId,
      accountPublicKey,
    }
    return {
      accountId,
      publicKey: keyPair.publicPEM,
      privateKey: keyPair.privatePEM,
    }
  }

  async removeAccount(accountId: string): Promise<void> {
    if (this.accounts[accountId] === undefined) {
      throw new Error(`account ${accountId} does not exist`)
    }
    delete this.accounts[accountId]
  }

  async getAccount(accountId: string): Promise<AccountInfo> {
    const ret = this.accounts[accountId]
    if (ret === undefined) {
      throw new Error(`No such account ${accountId}`)
    }
    return ret
  }

}


class MockServerConnection implements ServerConnection {
  private readonly server: MockServer
  private readonly baseUrl: string
  private readonly serverPrivateKey: EncryptionKey
  readonly accountManager: AccountManangerImpl
  delayMillisMin: integer
  delayMillisMax: integer

  constructor(
      server: MockServer,
      serverPrivateKey: EncryptionKey,
      baseUrl: string,
  ) {
    this.accountManager = new AccountManangerImpl()
    this.server = server
    this.serverPrivateKey = serverPrivateKey
    this.baseUrl = baseUrl
    this.delayMillisMin = 0
    this.delayMillisMax = 1000
  }

  async post(
      uri: string, headers: {[keys: string]: string}, payload: JSONValueType | null
  ): Promise<Response> {
    try {
      await this.delay()
      const partial = await this.processPost(uri, headers, payload)
      const sig = await this.createSignature()
      const resp = {
        ...partial,
        sig,
      }
      return {
        code: resp.code,
        reason: 'OK',
        headers: { authorization: resp.sig },
        payload: UTF8_ENCODER.encode(JSON.stringify(resp.payload)),
      }
    } catch (err) {
      return MockServerConnection.onErr(err)
    }
  }

  async get(
      uri: string, headers: {[keys: string]: string}, parameters: {[keys: string]: string}
  ): Promise<Response> {
    try {
      await this.delay()
      const partial = await this.processGet(uri, headers, parameters)
      const sig = await this.createSignature()
      const resp = {
        ...partial,
        sig,
      }
      return {
        code: resp.code,
        reason: 'OK',
        headers: { authorization: resp.sig },
        payload: UTF8_ENCODER.encode(JSON.stringify(resp.payload)),
      }
    } catch (err) {
      return MockServerConnection.onErr(err)
    }
  }

  private async processPost(
    uri: string,
    headers: {[keys: string]: string},
    payload: JSONValueType | null,
  ): Promise<{ code: integer, payload: JSONValueType }> {
    const pathParts = await this.stripPath(uri)
    if (pathParts.length === 1 && pathParts[0] === 'account') {
      // Anonymous request.
      const ret = await this.server.handleCreateAccount()
      return {
        code: 200,
        payload: asJsonObject(ret),
      }
    }
    if (pathParts.length === 1 && pathParts[0] === 'game') {
      const requestor = await this.validateSignature(pathParts, 'POST', {}, headers, payload)
      const data = await getPayloadObj(payload)
      // The real server would validate the types
      const name = data.name as string
      const maxPlayers = data.maxPlayers as integer
      const ret = await this.server.handleStartGameLobby(requestor, name, maxPlayers)
      return {
        code: 200,
        payload: asJsonObject(ret),
      }
    }

    throw new ServerError(404, 'NOT FOUND', `unknown request path ${pathParts.join("/")}`)
  }

  private async processGet(
    uri: string,
    headers: {[keys: string]: string},
    parameters: {[keys: string]: string},
  ): Promise<{ code: integer, payload: JSONValueType }> {
    const pathParts = await this.stripPath(uri)
    if (pathParts.length === 2 && pathParts[0] === 'server' && pathParts[1] === 'parameters') {
      const requestor = await this.validateSignature(pathParts, 'GET', parameters, headers, null)
      const ret = await this.server.handleGetServerParameters(requestor)
      return {
        code: 200,
        payload: asJsonObject(ret),
      }
    }
    if (pathParts.length === 2 && pathParts[0] === 'game') {
      const requestor = await this.validateSignature(pathParts, 'GET', parameters, headers, null)
      const gameId = pathParts[1]
      if (gameId.length <= 0) {
        throw new ServerError(400, 'INVALID REQUEST', 'No gameId given')
      }
      const ret = await this.server.handleGetGameParameters(requestor, gameId)
      return {
        code: 200,
        payload: asJsonObject(ret),
      }
    }
    if (pathParts.length === 3 && pathParts[0] === 'game' && pathParts[2] === 'segment') {
      const requestor = await this.validateSignature(pathParts, 'GET', parameters, headers, null)
      const gameId = pathParts[1]
      if (gameId.length <= 0) {
        throw new ServerError(400, 'INVALID REQUEST', 'No gameId given')
      }
      // A real server would validate the input
      const x = parseInt(parameters.x)
      const y = parseInt(parameters.y)
      const width = parseInt(parameters.width)
      const height = parseInt(parameters.height)
      const ret = await this.server.handleLoadSegment(requestor, gameId, x, y, width, height)
      return {
        code: 200,
        payload: asJsonObject(ret),
      }
    }


    throw new ServerError(404, 'NOT FOUND', `unknown request path ${pathParts.join("/")}`)
  }

  private delay(): Promise<void> {
    const delaySecs = (
      (Math.random() * (this.delayMillisMax - this.delayMillisMin))
      + this.delayMillisMin
    ) / 1000
    console.debug(`Delaying request by ${delaySecs} secs`)
    return new Promise(vars => setTimeout(vars, delaySecs))
  }


  private async stripPath(uri: string): Promise<string[]> {
    if (uri.startsWith(this.baseUrl)) {
      uri = uri.substring(this.baseUrl.length)
      const ret: string[] = []
      uri.split('/').forEach((p) => {
        if (p.length > 0) {
          ret.push(p)
        }
      })
      return ret
    }
    throw new ServerError(400, 'BAD URL', `URI ${uri} does not match server ${this.baseUrl}`)
  }

  private static async onErr(err: any): Promise<Response> {
    if (err instanceof ServerError) {
      return {
        code: err.code,
        reason: err.reason,
        headers: {},
        payload: UTF8_ENCODER.encode(err.message),
      }
    }
    return {
      code: 500,
      reason: String(err),
      headers: {},
      payload: new Uint8Array(),
    }
  }

  private async createSignature(): Promise<string> {
    const b64Header = btoa(JSON.stringify({}))
    const sig = await createSignature(this.serverPrivateKey, SIG_HASH_ALGORITHM, b64Header)
    return `SIG ${b64Header}.${sig}`
  }

  private async validateSignature(
      _pathParts: string[],
      _method: string,
      _parameters: {[keys: string]: string},
      headers: {[keys: string]: string},
      _body: JSONValueType | null,
  ): Promise<AccountInfo> {
    const sigHeader = headers.authorization
    if (sigHeader === undefined) {
      throw new ServerError(401, 'UNAUTHORIZED', 'no authorization header')
    }
    if (! sigHeader.startsWith('SIG ')) {
      throw new ServerError(401, 'UNAUTHORIZED', 'no valid authorization header')
    }
    const sigStr = sigHeader.substring(4)
    const p1 = sigStr.indexOf('.')
    if (p1 <= 0) {
      throw new ServerError(401, 'UNAUTHORIZED', 'no valid authorization header')
    }
    const b64Header = sigStr.substring(0, p1)
    const sig = sigStr.substring(p1 + 1)
    let sigPayload: {[keys: string]: any}
    try {
      // Generally bad form to decode then check...
      const payloadRaw = JSON.parse(atob(b64Header))
      if (Array.isArray(payloadRaw) || typeof payloadRaw !== 'object') {
        throw new ServerError(401, 'UNAUTHORIZED', 'no valid authorization header')
      }
      sigPayload = payloadRaw
    } catch (err) {
      if (err instanceof ServerError) {
        throw err
      }
      throw new ServerError(401, 'UNAUTHORIZED', 'no valid authorization header')
    }
    const accountId = sigPayload.aid
    if (typeof accountId !== 'string') {
      throw new ServerError(401, 'UNAUTHORIZED', 'no valid authorization header')
    }
    const createdAtTime = sigPayload.iat
    // const bodySha256 = sigPayload.sha256 as string
    const now = Math.floor(Date.now() / 1000)
    if (
        typeof createdAtTime === 'number'
        && (
          createdAtTime > now + TOKEN_TIMEOUT_SECONDS
          || createdAtTime < now - TOKEN_TIMEOUT_SECONDS
        )) {
      throw new ServerError(401, 'UNAUTHORIZED', 'authorization timed out')
    }
    if (!this.accountManager.hasAccount(accountId)) {
      // Don't leak information
      // A real server should simulate same amount of time as account fetching & validation.
      throw new ServerError(401, 'UNAUTHORIZED', 'invalid signature')
    }
    const account = await this.accountManager.getAccount(accountId)
    const isValid = await verifySignature(account.accountPublicKey, SIG_HASH_ALGORITHM, b64Header, sig)
    if (!isValid) {
      throw new ServerError(401, 'UNAUTHORIZED', 'invalid signature')
    }
    // TODO check created at time.
    // TODO check body sha256...
    return account
  }
}


async function getPayloadObj(payload: JSONValueType | null): Promise<{[keys: string]: JSONValueType}> {
  if (payload === null) {
    return {}
  }
  if (Array.isArray(payload) || typeof payload !== 'object') {
    throw new ServerError(400, 'INVALID REQUEST', 'body must be an object')
  }
  return payload
}


function asJsonObject(
    value: object | any[] | string | number | Date | boolean | null | undefined
): JSONValueType {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    const v = value | 0
    if (v === value) {
      return v
    }
    // Floating point
    return String(v)
  }
  if (value instanceof Date) {
    return value.toUTCString()
  }
  if (Array.isArray(value)) {
    return value.map((v) => asJsonObject(v))
  }
  if (typeof value === 'object') {
    const src: {[keys: string]: any} = value
    const ret: {[keys: string]: JSONValueType} = {}
    Object.keys(value).forEach((k) => {
      ret[k] = asJsonObject((src[k] as unknown) as object)
    })
    return ret
  }
  throw new Error(`Not serializable type: ${value}`)
}
