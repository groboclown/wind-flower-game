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
    const fullPath = [...this.basePath, ...path]
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

  asStr(...elements: JSONPathElement[]): string | null {
    const value = this.getPath(elements)
    if (typeof value.value === 'string') {
      return value.value
    }
    return null
  }

  asStrOr(defaultValue: string, ...elements: JSONPathElement[]): string {
    const value = this.getPath(elements)
    if (typeof value.value === 'string') {
      return value.value
    }
    return defaultValue
  }
}


export function parseJsonLookup(source: string): JsonLookup | string {
  try {
    return new JsonLookup(JSON.parse(source), [])  // eslint-disable-line @typescript-eslint/no-unsafe-argument
  } catch (err) {
    return 'Invalid JSON format'
  }
}
