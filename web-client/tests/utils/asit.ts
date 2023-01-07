// As It Goes
import {expect, it} from '@jest/globals'

export function asit(description: string, theTest: () => Promise<void>): void {
  it(description, () => {
    expect(theTest()).resolves.toBe(undefined)
  })
}
