import { test, expect } from 'vitest'
import * as crypto from 'crypto'
import * as path from 'path'
import * as fs from 'fs'

// @ts-ignore
globalThis.crypto = crypto
console.log('crypto.getRandomValues =>', globalThis.crypto.getRandomValues)

const parsers = fs.readdirSync('./parsers')
const fixtures = fs.readdirSync('./fixtures')

for (const parser of parsers) {
  if (parser !== 'astro') continue
  const parse = await import('../parsers/' + parser)

  for (const fixture of fixtures) {
    const fixtureId = path.resolve('../fixtures/', fixture, 'index.' + parser)
    if (!fs.existsSync(fixtureId)) continue

    test('parse : ' + fixture + ' : ' + parser, () => {
      console.log({ [parser]: parse })
    })
  }
}
