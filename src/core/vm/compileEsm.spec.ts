import endent from 'endent'
import { describe, expect, it } from 'vitest'
import { compileEsm } from './compileEsm'

describe('compileEsm', () => {
  it('handles `export {}` of mutable variable', async () => {
    let result = await transform`
      let a = 1
      const b = 2
      export {a, b}
    `
    expect(result).toMatchInlineSnapshot(`
      "let a = 1
      const b = 2
      __exportLet(__exports, \\"a\\", () => a)
      __exports.b = b"
    `)
    // Import specifier cannot be assumed immutable
    // unless it's a default specifier or namespace.
    result = await transform`
      import {a} from "a"
      import b from "b"
      import * as c from "c"
      export {a, b, c}
    `
    expect(result).toMatchInlineSnapshot(`
      "const _a = await __requireAsync(\\"a\\");
      const b = __importDefault(await __requireAsync(\\"b\\"));
      const c = __importAll(await __requireAsync(\\"c\\"));
      __exportLet(__exports, \\"a\\", () => _a.a)
      __exports.b = b
      __exports.c = c"
    `)
  })
})

// Compile ESM and return the code.
async function transform(code: TemplateStringsArray, ...values: any[]) {
  const editor = await compileEsm({
    code: endent(code, ...values),
    filename: 'test.js',
    esmHelpers: new Set(),
  })
  return editor.toString()
}
