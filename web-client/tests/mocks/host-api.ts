// Mock tools for host connections
import { KEYUTIL, KJUR } from 'jsrsasign'
import { RestApiConnection, HostApi } from '../../src/server/api'
import { JsonLookup } from '../../src/lib/typed-json'
import {
  NewAccount,
  ServerParameters,
  SegmentTileCollection,
  GameParameters,
  GameLobbyCreated,
  SegmentTile,
} from '../../src/server/structs'
import {
  MockServer,
  AccountInfo,
} from '../../src/server/mock-server'
import {
  EncryptionKey,
} from '../../src/lib/crypto'


export class NotRestApiConnection implements RestApiConnection {
  setServerPublicKey(): Promise<void> {
    throw new Error('Do not use.')
  }

  setAccountConnectionInformation(): Promise<void> {
    throw new Error('Do not use.')
  }

  getJson(): Promise<JsonLookup> {
    throw new Error('Do not use.')
  }
  postJson(): Promise<JsonLookup> {
    throw new Error('Do not use.')
  }

  postAnonymousJson(): Promise<JsonLookup> {
    throw new Error('Do not use.')
  }
}


export function createAccount(accountId: string): {
    account: AccountInfo, privateKey: EncryptionKey, passCode: string,
    publicKeyPEM: string, privateKeyPEM: string,
} {
  // No promise version.
  const keyPair = KEYUTIL.generateKeypair('EC', 'secp256r1')
  const publicKey = keyPair.pubKeyObj as KJUR.crypto.ECDSA
  const privateKey = keyPair.prvKeyObj as KJUR.crypto.ECDSA
  const publicKeyPEM = KEYUTIL.getPEM(publicKey)
  const privateKeyPEM = KEYUTIL.getPEM(privateKey, 'PKCS5PRV', '')
  return {
    account: { accountId, accountPublicKey: publicKey },
    privateKey,
    publicKeyPEM: publicKeyPEM,
    privateKeyPEM: privateKeyPEM,
    passCode: '',
  }
}


export class MockHostApi extends HostApi {
  account: AccountInfo
  server: MockServer

  constructor(server: MockServer, account: AccountInfo) {
    super(new NotRestApiConnection())
    this.account = account
    this.server = server
  }

  // createAccount request a new account from the server
  createAccount(): Promise<NewAccount> {
    return this.server.handleCreateAccount()
  }


  getServerParameters(): Promise<ServerParameters> {
    return this.server.handleGetServerParameters(this.account)
  }


  // startGameLobby start a new game lobby
  startGameLobby(name: string, maxPlayers: integer): Promise<GameLobbyCreated> {
    return this.server.handleStartGameLobby(this.account, name, maxPlayers)
  }


  getGameParameters(gameId: string): Promise<GameParameters> {
    return this.server.handleGetGameParameters(this.account, gameId)
  }


  // loadSegment load a game board segment at the x, y corner
  // Up to the maximum returned.
  loadSegment(
    gameId: string,
    x: integer,
    y: integer,
    width: integer,
    height: integer,
  ): Promise<SegmentTileCollection> {
    return this.server.handleLoadSegment(this.account, gameId, x, y, width, height)
  }
}


export class SegmentDataServer implements MockServer {
  tiles: SegmentTile[]

  constructor(tiles?: SegmentTile[]) {
    this.tiles = tiles || []
  }

  setAccountManager(): Promise<void> {
    throw new Error('Do not call')
  }
  handleCreateAccount(): Promise<NewAccount> {
    throw new Error('Do not call')
  }
  handleGetServerParameters(): Promise<ServerParameters> {
    throw new Error('Do not call')
  }
  handleStartGameLobby(): Promise<GameLobbyCreated> {
    throw new Error('Do not call')
  }
  handleGetGameParameters(): Promise<GameParameters> {
    throw new Error('Do not call')
  }
  async handleLoadSegment(
      _requestor: AccountInfo, _gameId: string, x: integer, y: integer, width: integer, height: integer,
  ): Promise<SegmentTileCollection> {
    const maxX = x + width
    const maxY = y + height
    const ret: SegmentTile[] = this.tiles.filter((t) => {
      return t.x >= x && t.x < maxX && t.y >= y && t.y < maxY
    })
    return {
      sizeX: width,
      sizeY: height,
      segments: ret,
    }
  }

}
