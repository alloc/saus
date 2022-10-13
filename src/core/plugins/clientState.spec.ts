import { SourceMap } from '@utils/node/sourceMap'
import endent from 'endent'
import { expect, test } from 'vitest'
import { clientStatePlugin } from './clientState'

const code = endent`
  import { defineStateModule } from "saus/client"
  import someClientLib from "some-client-lib"
  import anotherClientLib from "another-client-lib"
  import yetAnotherClientLib from "yet-another-client-lib"
  import { fetch } from "node-fetch"

  export const foo = defineStateModule('foo', () => fetch('/foo'))

  export const bar = defineStateModule('bar', {
    serve() {
      return fetch('/bar')
    },
    hydrate(args, state) {
      state.bar = yetAnotherClientLib(state.bar)
    }
  })

  const onLoadFoo = (args, state, expiresAt) => {
    someClientLib(state)
  }

  foo.onLoad(onLoadFoo)

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
