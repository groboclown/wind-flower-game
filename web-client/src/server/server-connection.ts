// Base API for talking with the server.
import { JsonLookup, JSONValueType } from '../lib/typed-json'
import {
  EncryptionKey,
  createSignature,
  verifySignature,
  generateSha512,
  generateEncryptionKeyFrom,
} from '../lib/crypto'
import { RestApiConnection } from './api'


export interface Response {
  code: integer
  reason: string | null

  // headers normalized where all keys are lower-case
  headers: {[keys: string]: string}

  payload: Uint8Array
}


// ServerConnection low level server communication object
export interface ServerConnection {
  post(uri: string, headers: {[keys: string]: string}, payload: JSONValueType | null): Promise<Response>
  get(uri: string, headers: {[keys: string]: string}, parameters: {[keys: string]: string}): Promise<Response>
}


interface NormalizedAuthRequest {
  // path the uri string, with no initial '/', and no parameters
  path: string
  method: string
  // params a list of (key, value) pairs, sorted by key.
  params: string[][]
  body: string
}


const AUTHORIZATION_HEADER_KEY = 'authorization'
export const SIG_HASH_ALGORITHM = 'SHA512withECDSA'
const UTF8_DECODER = new TextDecoder()


export class ServerRestApiConnection implements RestApiConnection {
  private connection: ServerConnection
  private serverPublicKey: EncryptionKey | null
  private baseUrl: string
  private accountId: string
  private accountPrivateKey: EncryptionKey | null

  constructor(connection: ServerConnection, baseUrl: string) {
    while (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.substring(0, baseUrl.length - 1)
    }
    this.connection = connection
    this.baseUrl = baseUrl + '/'
    this.serverPublicKey = null
    this.accountId = ''
    this.accountPrivateKey = null
  }

  async setServerPublicKey(key: string): Promise<void> {
    this.serverPublicKey = await generateEncryptionKeyFrom(key)
  }

  async setAccountConnectionInformation(
      accountId: string, accountPrivateKey: string, passKey: string,
  ): Promise<void> {
    this.accountId = accountId
    this.accountPrivateKey = await generateEncryptionKeyFrom(accountPrivateKey, passKey)
  }

  async getJson(path: string, parameters?: {[keys: string]: string | integer}): Promise<JsonLookup> {
    this.checkValid()

    const uri = this.mkUri(path)
    const authSig = await this.createAuthorization(normalizeAuthRequest({
      path, parameters, method: 'GET',
    }))
    const headers = {
      [AUTHORIZATION_HEADER_KEY]: authSig,
    }
    const resp = await this.connection.get(uri, headers, normalizeParameters(parameters))
    return await this.validateServerResponse(resp)
  }

  async postJson(path: string, body?: JSONValueType): Promise<JsonLookup> {
    this.checkValid()

    const uri = this.mkUri(path)
    const authSig = await this.createAuthorization(normalizeAuthRequest({
      path, method: 'POST', body,
    }))
    const headers = {
      [AUTHORIZATION_HEADER_KEY]: authSig,
    }
    const resp = await this.connection.post(uri, headers, body || null)
    return await this.validateServerResponse(resp)
  }

  async postAnonymousJson(path: string, body?: JSONValueType): Promise<JsonLookup> {
    // No authentication sent.
    const uri = this.mkUri(path)
    const resp = await this.connection.post(uri, {}, body || null)
    return await this.validateServerResponse(resp)
  }


  private mkUri(path: string): string {
    let startPath = 0
    while (path[startPath] === '/') {
      startPath++
    }
    return this.baseUrl + path.substring(startPath)
  }


  private checkValid() {
    if (this.serverPublicKey === null) {
      throw Error(`Server Connection not configured.`)
    }
  }


  private async createAuthorization(request: NormalizedAuthRequest): Promise<string> {
    if (this.accountPrivateKey === null || this.accountId === '') {
      throw Error(`Account Connection not configured.`)
    }
    const body = JSON.stringify(request)
    const now = Math.floor(Date.now() / 1000)
    const header = JSON.stringify({
      'aid': this.accountId,
      'iat': now,
      'sha256': await generateSha512(body),
    })
    // Use the encrypt then sign method.
    const b64Header = btoa(header)
    const sig = await createSignature(this.accountPrivateKey, SIG_HASH_ALGORITHM, b64Header)
    return `SIG ${b64Header}.${sig}`
  }

  // validateServerAuth middleware for validating the server's response.
  private async validateServerResponse(response: Response): Promise<JsonLookup> {
    const code = response.code
    if (code === 401) {
      // unauthorized
      return Promise.reject({
        code,
        reason: response.reason,
        error: `Account ID ${this.accountId} not authorized for ${this.baseUrl}`,
      })
    }
    if (code === 403) {
      // forbidden
      return Promise.reject({
        code,
        reason: response.reason,
        error: `Account ID ${this.accountId} has no access for ${this.baseUrl}`,
      })
    }
    if (code >= 500) {
      return Promise.reject({
        code,
        reason: response.reason,
        error: `Server error ${response.reason}`,
      })
    }
    if (code >= 400) {
      return Promise.reject({
        code,
        reason: response.reason,
        error: `Other issue`,
      })
    }

    // Try authorization.
    const auth = response.headers[AUTHORIZATION_HEADER_KEY]
    let isValid = false
    if (auth !== undefined && auth.startsWith('SIG ')) {
      const sigStr = auth.substring(4)
      const p1 = sigStr.indexOf('.')
      if (p1 > 0) {
        const b64Header = sigStr.substring(0, p1)
        const sig = sigStr.substring(p1 + 1)
        isValid = await this.checkServerSignature(sig, b64Header)
      }
    }
    if (! isValid) {
      return Promise.reject({
        code: 600,
        reason: 'client validation',
        error: `Server at ${this.baseUrl} failed client-side authorization`
      })
    }
    return new JsonLookup(JSON.parse(UTF8_DECODER.decode(response.payload)))
  }


  private async checkServerSignature(sig: string, b64Header: string): Promise<boolean> {
    if (this.serverPublicKey === null) {
      throw new Error('server not initialized')
    }
    const isValid = await verifySignature(this.serverPublicKey, SIG_HASH_ALGORITHM, b64Header, sig)
    if (!isValid) {
      return false
    }

    // TODO verify the timestamp in the header.

    return true
  }
}


function normalizeAuthRequest(values: {
  path: string,
  method: string,
  parameters?: {[keys: string]: string | integer},
  body?: JSONValueType | string,
}): NormalizedAuthRequest {
  const params: string[][] = []
  const srcParameters = normalizeParameters(values.parameters)
  Object.keys(srcParameters).sort().forEach((k) => {
    params.push([k, srcParameters[k]])
  })
  let destBody = ''
  if (typeof values.body === 'string') {
    destBody = values.body
  } else if (values.body !== undefined) {
    destBody = JSON.stringify(values.body)
  }
  return {
    path: values.path,
    method: values.method.toUpperCase(),
    params,
    body: destBody,
  }
}


function normalizeParameters(
    parameters: {[keys: string]: string | integer} | undefined
): {[keys: string]: string} {
  if (parameters === undefined) {
    return {}
  }
  const ret: {[keys: string]: string} = {}
  const p: {[keys: string]: string | integer} = parameters
  Object.keys(p).forEach((k) => { ret[k] = String(p[k]) })
  return ret
}
