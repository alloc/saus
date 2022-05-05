import { test, expect } from 'vitest'
import * as path from 'path'
import * as fs from 'fs'

const parsers = fs.readdirSync('./parsers')
const fixtures = fs.readdirSync('./fixtures')

for (const parser of parsers) {
  const parse = await import('../parsers/' + parser)
  console.log({ [parser]: parse })

  for (const fixture of fixtures) {
    const fixtureId = path.resolve('../fixtures/', fixture, 'index.' + parser)
    if (!fs.existsSync(fixtureId)) continue

    test('parse : ' + fixture + ' : ' + parser, () => {})
  }
}
