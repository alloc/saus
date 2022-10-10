import endent from 'endent'
import { expect, test } from 'vitest'
import { SourceMap } from '../node/sourceMap'
import { clientStatePlugin } from './clientState'

const code = endent`
  import { defineStateModule } from "saus/client"
  import someClientLib from "some-client-lib"
  import anotherClientLib from "another-client-lib"
  import { fetch } from "node-fetch"

  export const foo = defineStateModule('foo', () => fetch('/foo'))

  const clientSideEffect = (args, state, expiresAt) => {
    someClientLib(state)
  }

  foo.onLoad(clientSideEffect)

  export { anotherClientLib }
`

test('clientStatePlugin', async () => {
  const plugin = clientStatePlugin()
  const transform = plugin.transform as (
    code: string,
    id: string,
    opts: { ssr: boolean }
  ) => Promise<{
    code: string
    map: SourceMap
  }>

  const result = await transform(code, 'state.ts', { ssr: false })
  if (!result || typeof result == 'string') {
    throw new Error('Expected result to be an object')
  }

  // result.code += toInlineSourceMap(result.map)

  expect(result).toMatchSnapshot()
  expect(result.map).not.toBe(null)
})
