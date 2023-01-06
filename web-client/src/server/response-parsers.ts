// Parse the struct responses from the server
//   These all can return "undefined" to work with the mapFilter function.

import { JsonLookup } from '../lib/typed-json'
import {
  NewAccount,
  SegmentTile,
  SegmentTileCollection,
  ServerParameters,
  ActiveGamePlayer,
  GameTileParameter,
  ServerTurnCompleted,
  TokenPlayedParameter,
  GameParameters,
  GameLobbyCreated,
  ChangedTile,
  TokenPlayed,
  DrawnToken,
} from './structs'


// ParsedValue top level data object return type.
export interface ParsedValue<Type> {
  readonly parsed: Type | undefined
  readonly problems: {[key: string]: string} | undefined
}


export function parseNewAccount(data: JsonLookup): ParsedValue<NewAccount> {
  const accountId = data.asStr('accountId')
  const publicKey = data.asStr('publicKey')
  const privateKey = data.asStr('privateKey')
  if (
    accountId !== undefined
    && publicKey !== undefined
    && privateKey !== undefined
  ) {
    return parsedOk({
      accountId,
      publicKey,
      privateKey,
    })
  }
  return parsedProblems({
    accountId: mustBeDefined(accountId),
    publicKey: mustBeDefined(publicKey),
    privateKey: mustBeDefined(privateKey),
  })
}


export function parseGameLobbyCreated(data: JsonLookup): ParsedValue<GameLobbyCreated> {
  const gameId = data.asStr('gameId')
  if (gameId !== undefined) {
    return parsedOk({
      gameId,
    })
  }
  return parsedProblems({
    gameId: mustBeDefined(gameId),
  })
}


export function parseGameParameters(data: JsonLookup): ParsedValue<GameParameters> {
  const gameName = data.asStr('gameName')
  const protectedGame = data.asBool('protected')
  const unlisted = data.asBool('unlisted')
  const runState = data.asStr('runState')
  const createdAt = data.asDate('createdAt')
  const minimumPlayerCount = data.asInt('minimumPlayerCount')
  const maximumPlayerCount = data.asInt('maximumPlayerCount')
  const maximumTurnCount = data.asInt('maximumTurnCount')
  const currentPlayerTurn = data.asInt('currentPlayerTurn')
  const currentBoardColumnMin = data.asInt('currentBoardColumnMin')
  const currentBoardRowMin = data.asInt('currentBoardRowMin')
  const currentBoardColumnMax = data.asInt('currentBoardColumnMax')
  const currentBoardRowMax = data.asInt('currentBoardRowMax')
  const lastTurn = parseServerTurnCompleted(data.pushPath('lastTurn')) || null

  const playersCount = data.getLength('players')
  const players: ActiveGamePlayer[] = data.mapFilter(['players'], parseActiveGamePlayer)
  const parametersCount = data.getLength('parameters')
  const parameters: GameTileParameter[] = data.mapFilter(['parameters'], parseGameTileParameter)

  if (
      gameName !== undefined
      && protectedGame !== undefined
      && unlisted !== undefined
      && runState !== undefined
      && createdAt !== undefined
      && minimumPlayerCount !== undefined
      && maximumPlayerCount !== undefined
      && maximumTurnCount !== undefined
      && currentBoardColumnMin !== undefined
      && currentBoardRowMin !== undefined
      && currentBoardColumnMax !== undefined
      && currentBoardRowMax !== undefined
      && currentPlayerTurn !== undefined
      && playersCount === players.length
      && parametersCount === parameters.length
      // lastTurn can be null
  ) {
    return parsedOk({
      gameName,
      protected: protectedGame,
      unlisted,
      runState,
      createdAt,
      minimumPlayerCount,
      maximumPlayerCount,
      maximumTurnCount,
      parameters,
      currentBoardColumnMin,
      currentBoardRowMin,
      currentBoardColumnMax,
      currentBoardRowMax,
      currentPlayerTurn,
      players,
      lastTurn,
    })
  }
  return parsedProblems({
    gameName: mustBeDefined(gameName),
    runState: mustBeDefined(runState),
    minimumPlayerCount: mustBeDefined(minimumPlayerCount),
    maximumPlayerCount: mustBeDefined(maximumPlayerCount),
    maximumTurnCount: mustBeDefined(maximumTurnCount),
    currentBoardColumnMin: mustBeDefined(currentBoardColumnMin),
    currentBoardRowMin: mustBeDefined(currentBoardRowMin),
    currentBoardColumnMax: mustBeDefined(currentBoardColumnMax),
    currentBoardRowMax: mustBeDefined(currentBoardRowMax),
    currentPlayerTurn: mustBeDefined(currentPlayerTurn),
    players: mustBeSameCount(playersCount, players),
    parameters: mustBeSameCount(parametersCount, parameters),
  })
}


export function parseSegmentTileCollection(data: JsonLookup): ParsedValue<SegmentTileCollection> {
  const sizeX = data.asInt('sizeX')
  const sizeY = data.asInt('sizeY')
  const segmentsCount = data.getLength('segments')
  const segments = data.mapFilter(['segments'], parseSegmentTile)

  if (
      sizeX !== undefined
      && sizeY !== undefined
      && segmentsCount === segments.length
  ) {
    return parsedOk({
      sizeX,
      sizeY,
      segments,
    })
  }
  return parsedProblems({
    sizeX: mustBeDefined(sizeX),
    sizeY: mustBeDefined(sizeY),
    segments: mustBeSameCount(segmentsCount, segments),
  })
}


export function parseSegmentTile(data: JsonLookup): SegmentTile | undefined {
  const posX = data.asInt('x')
  const posY = data.asInt('y')
  const height = data.asNumber('h')
  const category = data.asStr('c')
  const tokenId = data.asInt('t')
  const paramCount = data.getLength('p')
  // Quick optimization on parsing, because this is heavily used.
  const params = new Array<{i: integer, q: number}>(Math.max(0, paramCount))
  for (let j = 0; j < paramCount; j++) {
    const pIndex = data.asInt('p', j, 'i')
    const pQuantity = data.asNumber('p', j, 'q')
    if (pIndex === undefined || pQuantity === undefined) {
      return undefined
    }
    params[j] = {i: pIndex, q: pQuantity}
  }
  if (
      posX !== undefined
      && posY !== undefined
      && height !== undefined
      && category !== undefined
      && tokenId !== undefined) {
    return {
      x: posX,
      y: posY,
      h: height,
      c: category,
      t: tokenId,
      p: params
    }
  }
  return undefined
}


export function parseActiveGamePlayer(data: JsonLookup): ActiveGamePlayer | undefined {
  const playerIndex = data.asInt('playerIndex')
  const publicName = data.asStr('publicName')
  const lastConnectedTime = data.asDate('lastConnectedTime')
  const state = data.asStr('state')
  const score = data.asNumber('score')
  if (
    playerIndex !== undefined
    && publicName !== undefined
    && state !== undefined
    // lastConnectedTime can be undefined
    // score can be undefined
  ) {
    return {
      playerIndex,
      publicName,
      lastConnectedTime,
      state,
      score,
    }
  }
  return undefined
}


export function parseGameTileParameter(data: JsonLookup): GameTileParameter | undefined {
  const parameterIndex = data.asInt('parameterIndex')
  const name = data.asStr('name')
  if (
      parameterIndex !== undefined
      && name !== undefined
  ) {
    return {
      parameterIndex,
      name,
    }
  }
  return undefined
}


export function parseServerParameters(data: JsonLookup): ParsedValue<ServerParameters> {
  const maximumTileWidth = data.asInt('maximumTileWidth')
  const maximumTileHeight = data.asInt('maximumTileHeight')
  const maximumPlayerCount = data.asInt('maximumPlayerCount')
  if (
    maximumTileWidth !== undefined
    && maximumTileHeight !== undefined
    && maximumPlayerCount !== undefined
  ) {
    return parsedOk({
      maximumTileWidth,
      maximumTileHeight,
      maximumPlayerCount,
    })
  }
  return parsedProblems({
    maximumTileWidth: mustBeDefined(maximumTileWidth),
    maximumTileHeight: mustBeDefined(maximumTileHeight),
    maximumPlayerCount: mustBeDefined(maximumPlayerCount),
  })
}


export function parseServerTurnCompleted(data: JsonLookup): ServerTurnCompleted | undefined {
  const completedPlayerTurn = data.asInt('completedPlayerTurn')
  const nextPlayerTurn = data.asInt('nextPlayerTurn')
  const turnCompletedAt = data.asDate('turnCompletedAt')
  const tokenPlayed = parseTokenPlayed(data.pushPath('tokenPlayed'))
  const tileChangesCount = data.getLength('tileChanges')
  const tileChanges: ChangedTile[] = data.mapFilter(['tileChanges'], parseChangedTile)
  const tokenDrawn = parseDrawnToken(data.pushPath('tokenDrawn'))

  if (
    completedPlayerTurn !== undefined
    && nextPlayerTurn !== undefined
    && turnCompletedAt !== undefined
    && tokenPlayed !== undefined
    && tileChangesCount === tileChanges.length
    // tokenDrawn can be undefined
  ) {
    return {
      completedPlayerTurn,
      nextPlayerTurn,
      turnCompletedAt,
      tokenPlayed,
      tileChanges,
      tokenDrawn,
    }
  }
  return undefined
}


export function parseTokenPlayed(data: JsonLookup): TokenPlayed | undefined {
  const x = data.asInt('x')
  const y = data.asInt('y')
  const h = data.asStr('h')
  const category = data.asStr('category')
  const parameterCount = data.getLength('parameters')
  const parameters: TokenPlayedParameter[] = data.mapFilter(['parameters'], parseTokenPlayedParameter)

  if (
    x !== undefined
    && y !== undefined
    && h !== undefined
    && category !== undefined
    && parameterCount === parameters.length
  ) {
    return {
      x,
      y,
      h,
      category,
      parameters,
    }
  }
  return undefined
}


export function parseTokenPlayedParameter(data: JsonLookup): TokenPlayedParameter | undefined {
  const parameterIndex = data.asInt('parameterIndex')
  const quantity = data.asNumber('quantity')
  const direction = data.asInt('direction')
  if (
    parameterIndex !== undefined
    && quantity !== undefined
    && direction !== undefined
  ) {
    return {
      parameterIndex,
      quantity,
      direction,
    }
  }
  return undefined
}


export function parseChangedTile(data: JsonLookup): ChangedTile | undefined {
  const x = data.asInt('x')
  const y = data.asInt('y')
  const h = data.asNumber('h')
  const category = data.asStr('category')
  const parametersCount = data.getLength('parameters')
  const parameters: TokenPlayedParameter[] = data.mapFilter(['parameters'], parseTokenPlayedParameter)

  if (
    x !== undefined
    && y !== undefined
    // h can be undefined
    // category can be undefined
    && parametersCount === parameters.length
  ) {
    return {
      x,
      y,
      h,
      category,
      parameters,
    }
  }
  return undefined
}


export function parseDrawnToken(data: JsonLookup): DrawnToken | undefined {
  const name = data.asStr('name')

  const category00 = data.asStr('category00')
  const parameters00Count = data.getLength('parameters00')
  const parameters00: TokenPlayedParameter[] = data.mapFilter(['parameters00'], parseTokenPlayedParameter)

  const category01 = data.asStr('category01')
  const parameters01Count = data.getLength('parameters01')
  const parameters01: TokenPlayedParameter[] = data.mapFilter(['parameters01'], parseTokenPlayedParameter)

  const category02 = data.asStr('category02')
  const parameters02Count = data.getLength('parameters02')
  const parameters02: TokenPlayedParameter[] = data.mapFilter(['parameters02'], parseTokenPlayedParameter)

  const category10 = data.asStr('category10')
  const parameters10Count = data.getLength('parameters10')
  const parameters10: TokenPlayedParameter[] = data.mapFilter(['parameters10'], parseTokenPlayedParameter)

  const category11 = data.asStr('category11')
  const parameters11Count = data.getLength('parameters11')
  const parameters11: TokenPlayedParameter[] = data.mapFilter(['parameters11'], parseTokenPlayedParameter)

  const category12 = data.asStr('category12')
  const parameters12Count = data.getLength('parameters12')
  const parameters12: TokenPlayedParameter[] = data.mapFilter(['parameters12'], parseTokenPlayedParameter)

  if (
    name !== undefined

    && category00 !== undefined
    && parameters00Count === parameters00.length

    && category01 !== undefined
    && parameters01Count === parameters01.length

    && category02 !== undefined
    && parameters02Count === parameters02.length

    && category10 !== undefined
    && parameters10Count === parameters10.length

    && category11 !== undefined
    && parameters11Count === parameters11.length

    && category12 !== undefined
    && parameters12Count === parameters12.length
  ) {
    return {
      name,
      category00,
      parameters00,
      category01,
      parameters01,
      category02,
      parameters02,
      category10,
      parameters10,
      category11,
      parameters11,
      category12,
      parameters12,
    }
  }
  return undefined
}


function parsedOk<Type>(value: Type): ParsedValue<Type> {
  return {
    parsed: value,
    problems: undefined,
  }
}


function mustBeDefined(value: any): string | undefined {
  if (value === undefined) {
    return "not set"
  }
  return undefined
}


function mustBeSameCount(expectedCount: integer, actual: any[]): string | undefined {
  if (expectedCount !== actual.length) {
    return "not every item was valid"
  }
  return undefined
}


function parsedProblems<Type>(conditions: {[keys: string]: string | undefined}): ParsedValue<Type> {
  const problems: {[keys: string]: string} = {}
  Object.keys(conditions).forEach((key) => {
    const res = conditions[key]
    if (res !== undefined && res !== "") {
      problems[key] = res
    }
  })
  return {
    parsed: undefined,
    problems,
  }
}
