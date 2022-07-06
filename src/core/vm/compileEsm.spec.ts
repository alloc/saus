import endent from 'endent'
import { afterEach, describe, expect, test } from 'vitest'
import { compileEsm } from './compileEsm'

describe('compileEsm', () => {
  test('import references', async () => {
    let result = await transform`
      import foo from 'foo'
      import bar from './bar'
      export { bar }
      export default () => {
        foo({ foo })
      }
    `
    // Notice how the `bar` reference is transformed into `_bar.default`
    // while the `foo` references use the `__importDefault` helper.
    // It's assumed that import bindings from a relative module
    // are never CommonJS-based, so no interop is needed.
    expect(result).toMatchInlineSnapshot(`
      "const _foo = await __requireAsync(\\"foo\\");
      const _bar = await __requireAsync(\\"./bar\\");
      __exportLet(__exports, \\"bar\\", () => _bar.default);
      __exports.default = () => {
        __importDefault(_foo)({ foo: __importDefault(_foo) })
      }"
    `)
  })
  test('preserved imports', async () => {
    let result = await transform`
      import {render} from './render'
      import {defineLayout} from '${skippedId}'
      export default defineLayout({
        render,
      })
    `
    expect(result).toMatchInlineSnapshot(
      `
      "import {defineLayout} from 'skipped'
      const _render = await __requireAsync(\\"./render\\");
      __exports.default = defineLayout({
        render: _render.render,
      })"
    `
    )
  })
  test('import default and named', async () => {
    let result = await transform`
      import A, { B } from 'mod'
      import { default as X } from 'x'
      export { A, B, X }
    `
    expect(result).toMatchInlineSnapshot(`
      "const _mod = await __requireAsync(\\"mod\\");
      const _x = await __requireAsync(\\"x\\");
      __exportLet(__exports, \\"A\\", () => __importDefault(_mod))
      __exportLet(__exports, \\"B\\", () => _mod.B)
      __exportLet(__exports, \\"X\\", () => __importDefault(_x));
      "
    `)
  })
  test('export default as', async () => {
    let result = await transform`
      export {default as Foo} from 'foo'
    `
    expect(result).toMatchInlineSnapshot(`
      "const _foo = await __requireAsync(\\"foo\\");
      __exportLet(__exports, \\"Foo\\", () => _foo.default);
      "
    `)
  })
  test('export const', async () => {
    let result = await transform`
      export const a = 1
    `
    expect(result).toMatchInlineSnapshot(`
      "const a = 1
      __exports.a = a;"
    `)
  })
  test('export const multiple', async () => {
    try {
      await transform`
        export const a = 1, b = 2
      `
      expect(1).toBe(2)
    } catch (e: any) {
      expect(e.message).toMatchInlineSnapshot(
        '"Multiple declarators in \\"export const\\" statement is unsupported"'
      )
    }
  })
  test('export * as', async () => {
    let result = await transform`
      export * as Foo from 'foo'
      import * as Bar from 'bar'
      export { Bar }
    `
    expect(result).toMatchInlineSnapshot(
      `
      "const Bar = __importAll(await __requireAsync(\\"bar\\"));
      __exports.Foo = __importAll(await __requireAsync(\\"foo\\"));
      __exports.Bar = Bar;
      "
    `
    )
  })
  test('export function/class', async () => {
    let result = await transform`
      export function foo () {}
      export class Foo {}
    `
    expect(result).toMatchInlineSnapshot(`
      "function foo () {}
      __exports.foo = foo;
      class Foo {}
      __exports.Foo = Foo;"
    `)
  })
  test('export default function/class', async () => {
    let result = await transform`
      export default function foo () {}
    `
    expect(result).toMatchInlineSnapshot(`
      "function foo () {}
      __exports.default =  foo;"
    `)
    result = await transform`
      export default function () { return 1 }
    `
    expect(result).toMatchInlineSnapshot(
      '"__exports.default = function () { return 1 }"'
    )
    result = await transform`
      export default (a, b) => Math.max(a, b)
    `
    expect(result).toMatchInlineSnapshot(
      '"__exports.default = (a, b) => Math.max(a, b)"'
    )
    result = await transform`
      export default class Foo { a = 1 }
    `
    expect(result).toMatchInlineSnapshot(
      `
      "class Foo { a = 1 }
      __exports.default =  Foo;"
    `
    )
    result = await transform`
      export default class { a = 1 }
    `
    expect(result).toMatchInlineSnapshot(
      '"__exports.default = class { a = 1 }"'
    )
  })
  test('export local variable', async () => {
    let result = await transform`
      let a = 1
      const b = () => (a += 1)
      export {a, b}
    `
    expect(result).toMatchInlineSnapshot(`
      "let a = 1
      const b = () => (a += 1)
      __exportLet(__exports, \\"a\\", () => a)
      __exports.b = b;
      "
    `)
    // Import binding cannot be assumed constant unless it's
    // a namespace specifier.
    // Technically, default specifiers can be assumed constant
    // in typical runtime, but not if hot reloading is used.
    result = await transform`
      import {a} from "a"
      import b from "b"
      import * as c from "c"
      export {a, b, c}
    `
    expect(result).toMatchInlineSnapshot(`
      "const _a = await __requireAsync(\\"a\\");
      const _b = await __requireAsync(\\"b\\");
      const c = __importAll(await __requireAsync(\\"c\\"));
      __exportLet(__exports, \\"a\\", () => _a.a)
      __exportLet(__exports, \\"b\\", () => __importDefault(_b))
      __exports.c = c;
      "
    `)
  })
  test('interleaved import/export', async () => {
    let editor = await edit`
      export { default as layout } from '../layouts/default.js';
      import * as NotFound from '../pages/NotFound.js';
      export { NotFound as routeModule };
    `
    editor.prependRight(
      editor.hoistIndex,
      `__d("test.js", async (__exports) => {\n`
    )
    editor.append('\n})')
    expect(editor.toString()).toMatchInlineSnapshot(`
      "__d(\\"test.js\\", async (__exports) => {
      const NotFound = __importAll(await __requireAsync(\\"../pages/NotFound.js\\"));
      const _default = await __requireAsync(\\"../layouts/default.js\\");
      __exportLet(__exports, \\"layout\\", () => _default.default);
      __exports.routeModule = NotFound;

      })"
    `)
  })
  describe('exported declaration', () => {
    test('default object', async () => {
      let result = await transform`
        export default {}
      `
      expect(result).toMatchInlineSnapshot('"__exports.default = {}"')
    })
    test('default anonymous function', async () => {
      let result = await transform`
        export default function () {}
      `
      expect(result).toMatchInlineSnapshot(
        '"__exports.default = function () {}"'
      )
    })
    test('default named function', async () => {
      let result = await transform`
        export default function test() {}
      `
      expect(result).toMatchInlineSnapshot(`
        "function test() {}
        __exports.default =  test;"
      `)
    })
    test('default anonymous class', async () => {
      let result = await transform`
        export default class {}
      `
      expect(result).toMatchInlineSnapshot('"__exports.default = class {}"')
    })
    test('default named class', async () => {
      let result = await transform`
        export default class Foo {}
      `
      expect(result).toMatchInlineSnapshot(`
        "class Foo {}
        __exports.default =  Foo;"
      `)
    })
    test('const class', async () => {
      let result = await transform`
        export class Foo {}
      `
      expect(result).toMatchInlineSnapshot(`
        "class Foo {}
        __exports.Foo = Foo;"
      `)
    })
    test('const function', async () => {
      let result = await transform`
        export function test() {}
      `
      expect(result).toMatchInlineSnapshot(`
        "function test() {}
        __exports.test = test;"
      `)
    })
    test('const binding', async () => {
      let result = await transform`
        export const a = 1
        export const b = 2
      `
      expect(result).toMatchInlineSnapshot(`
        "const a = 1
        __exports.a = a;
        const b = 2
        __exports.b = b;"
      `)
    })
  })
  describe('hotLinks option', () => {
    test('reference in exported object', async () => {
      await transform`
        import A from 'a'
        import {b} from 'b'
        export default { A }
        const B = { b }
        export { B }
      `
      expect(hotLinks).toMatchInlineSnapshot(`
        Set {
          "a",
          "b",
        }
      `)
    })
    test('reference in exported function', async () => {
      // This should *not* mutate hotLinks, since the
      // reference is within a function scope.
      await transform`
        import A from 'a'
        export function getA() {
          return A
        }
      `
      expect(hotLinks).toMatchInlineSnapshot('Set {}')

      // This *should* mutate hotLinks, because the function
      // is called at the top-level.
      await transform`
        import A from 'a'
        export function getA() {
          return A
        }
        getA()
      `
      expect(hotLinks).toMatchInlineSnapshot(`
        Set {
          "a",
        }
      `)

      // Same here, but with const binding.
      await transform`
        import A from 'a'
        export const getA = () => {
          return A
        }
        getA()
      `
      expect(hotLinks).toMatchInlineSnapshot(`
        Set {
          "a",
        }
      `)

      // Mutable bindings can only mutate `hotLinks` if not re-assigned.
      await transform`
        import A from 'a'
        export let getA = () => {
          return A
        }

        import B from 'b'
        export let getB
        getB = () => B

        getA()
        getB()
      `
      expect(hotLinks).toMatchInlineSnapshot(`
        Set {
          "a",
        }
      `)
    })
    test('reference in object method', async () => {
      // This should *not* mutate hotLinks, since the
      // reference is within a function scope.
      await transform`
        import A from 'a'
        export default {
          getA: () => A,
        }
      `
      expect(hotLinks).toMatchInlineSnapshot('Set {}')

      // This *could* mutate hotLinks, but the edge cases around
      // object methods are numerous, so avoid it for consistency.
      await transform`
        import A from 'a'
        export const foo = {
          getA: () => A,
        }
        foo.getA()
      `
      expect(hotLinks).toMatchInlineSnapshot('Set {}')
    })
  })
})

const skippedId = 'skipped'
const esmHelpers = new Set<Function>()
const hotLinks = new Set<string>()

afterEach(() => {
  esmHelpers.clear()
  hotLinks.clear()
})

function edit(code: TemplateStringsArray, ...values: any[]) {
  return compileEsm({
    code: endent(code, ...values),
    filename: 'test.js',
    resolveId: async id => (id === skippedId ? '' : id),
    esmHelpers,
    hotLinks,
  })
}

async function transform(code: TemplateStringsArray, ...values: any[]) {
  return (await edit(code, ...values)).toString()
}
