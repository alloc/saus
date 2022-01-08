import { describe, expect, it } from 'vitest'
import { transformSync } from 'esbuild'
import { dataToEsm } from './dataToEsm'

describe('dataToEsm', () => {
  it('handles multi-line strings', () => {
    const str = 'a\nb\nc\n'
    expect(evaluate(dataToEsm(str))).toBe(str)
    expect(evaluate(dataToEsm({ str })).str).toBe(str)
    expect(evaluate(dataToEsm([str]))[0]).toBe(str)
    expect(evaluate(dataToEsm({ title: '', test: [str] })).test[0]).toBe(str)
  })
})

function evaluate(code: string) {
  console.log({ code })
  const transformed = transformSync(code, { loader: 'js', format: 'cjs' })
  const init = new Function('module', 'exports', transformed.code)
  const mod: any = { exports: {} }
  init(mod, mod.exports)
  return mod.exports.default
}
