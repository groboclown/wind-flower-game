// JSON path scanner.

import { JSONValueType } from './json-typed'

// A single entry in a path to an entry in a json object
export type JSONPathElement = number | string
// A full path to a value in a json object
export type JSONPath = JSONPathElement[]

export interface JsonEntry {
  path: JSONPath,
  value: undefined | JSONValueType,
  found: boolean,
}

export class JsonLookup {
  private root: JSONValueType
  private basePath: JSONPath

  constructor(root: JSONValueType, basePath?: JSONPath) {
    this.root = root
    this.basePath = [...(basePath || [])]
  }

  pushPath(...elements: JSONPathElement[]): JsonLookup {
    return new JsonLookup(this.root, [...this.basePath, ...elements])
  }

  popPath(count = 1): JsonLookup {
    const nextPath = [...this.basePath]
    for (let i = 0; i < count; i++) {
      nextPath.pop()
    }
    return new JsonLookup(this.root, [...nextPath])
  }

  get(...elements: JSONPathElement[]): JsonEntry {
    return this.getPath(elements)
  }

  getPath(path: JSONPath): JsonEntry {
    return this.getFullPath([...this.basePath, ...path])
  }

  private getFullPath(fullPath: JSONPath): JsonEntry {
    const pathSoFar: JSONPath = []
    let current: JSONValueType = this.root
    for (let i = 0; i < fullPath.length; i++) {
      const el = fullPath[i]
      pathSoFar.push(el)
      if (current === null || current === undefined) {
        return {
          path: pathSoFar,
          value: current,
          found: false,
        }
      }
      if (Array.isArray(current)) {
        if (typeof el === 'number' && el >=0 && el < current.length) {
          current = current[el]
        } else {
          return {
            path: pathSoFar,
            value: undefined,
            found: false,
          }
        }
      } else if (typeof current === 'object') {
        if (typeof el === 'string' && el in current) {
          current = current[el]
        } else {
          return {
            path: pathSoFar,
            value: undefined,
            found: false,
          }
        }
      }
    }
    return {
      path: fullPath,
      value: current,
      found: true,
    }
  }

  getLength(...elements: JSONPathElement[]): integer {
    const value = this.getPath(elements)
    if (Array.isArray(value.value)) {
      return value.value.length
    }
    // < 0; Standard for loops over this will still work okay.
    return -1
  }

  asStr(...elements: JSONPathElement[]): string | undefined {
    const value = this.getPath(elements)
    if (typeof value.value === 'string') {
      return value.value
    }
    return undefined
  }

  asStrOr(defaultValue: string, ...elements: JSONPathElement[]): string {
    const value = this.getPath(elements)
    if (typeof value.value === 'string') {
      return value.value
    }
    return defaultValue
  }

  asInt(...elements: JSONPathElement[]): integer | undefined {
    const value = this.getPath(elements)
    if (typeof value.value === 'number') {
      return value.value | 0
    }
    return undefined
  }

  asNumber(...elements: JSONPathElement[]): number | undefined {
    const value = this.getPath(elements)
    if (typeof value.value === 'number') {
      return value.value
    }
    if (typeof value.value === 'string') {
      return parseFloat(value.value)
    }
    return undefined
  }

  asBool(...elements: JSONPathElement[]): boolean | undefined {
    const value = this.getPath(elements)
    if (typeof value.value === 'boolean') {
      return value.value
    }
    if (typeof value.value === 'number') {
      return (value.value | 0) !== 0
    }
    if (value.value === 'true') {
      return true
    }
    if (value.value === 'false') {
      return false
    }
    return undefined
  }

  // asDate parse a string as a UTC date string
  asDate(...elements: JSONPathElement[]): Date | undefined {
    const value = this.getPath(elements)
    if (typeof value.value === 'string') {
      const millis = Date.parse(value.value)
      if (isNaN(millis)) {
        return undefined
      }
      return new Date(millis)
    }
    return undefined
  }

  forEach(pathElements: JSONPathElement[], callback: ((data: JsonLookup) => void)) {
    const mapCallback = (d: JsonLookup): undefined => {
      callback(d)
      // Returning undefined here means we don't add space to the
      //   underlying array created by the mapFilter.
      return undefined
    }
    this.map(pathElements, mapCallback)
  }

  map<Type>(pathElements: JSONPathElement[], callback: ((data: JsonLookup) => Type)): Type[] {
    return this.mapFilter(pathElements, callback)
  }

  // mapFilter transform the item in the list into a value or, if returns undefined, then skip it
  mapFilter<Type>(pathElements: JSONPathElement[], callback: ((data: JsonLookup) => Type | undefined)): Type[] {
    // Faster version.
    const ret: Type[] = []
    const listPath = [...this.basePath, ...pathElements]
    const value = this.getFullPath(listPath)
    if (Array.isArray(value.value)) {
      // Make the last item in the full path a number.  It will be replaced inside the loop.
      const lastPos = listPath.length
      listPath.push(0)

      for (let i = 0; i < value.value.length; i++) {
        listPath[lastPos] = i
        const val = callback(new JsonLookup(this.root, listPath))
        if (val !== undefined) {
          ret.push(val)
        }
      }
    }

    return ret
  }

}


export function parseJsonLookup(source: string): JsonLookup | string {
  try {
    return new JsonLookup(JSON.parse(source), [])  // eslint-disable-line @typescript-eslint/no-unsafe-argument
  } catch (err) {
    return 'Invalid JSON format'
  }
}
