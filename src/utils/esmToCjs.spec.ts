import endent from 'endent'
import { describe, expect, it } from 'vitest'
import { MagicString, getBabelProgram } from '../babel'
import { esmExportsToCjs } from './esmToCjs'

describe('esmExportsToCjs', () => {
  describe('named exports', () => {
    it('rewrites functions', () => {
      expect(transform(`export function foo() {}`)).toMatchSnapshot()
    })
    it('rewrites classes', () => {
      expect(transform(`export class Foo {}`)).toMatchSnapshot()
    })
    it('rewrites bindings', () => {
      expect(transform(`export const foo = 1`)).toMatchSnapshot()
      expect(transform(`export let foo = 2`)).toMatchSnapshot()
    })
    it('rewrites identifiers', () => {
      const code = endent`
        const Foo = 1, Bar = 2
        export { Foo, Bar as default }
      `
      expect(transform(code)).toMatchSnapshot()
    })
  })
})

function transform(code: string) {
  const program = getBabelProgram(code, 'test.js')
  const editor = new MagicString(code)
  esmExportsToCjs(program, editor)
  return editor.toString()
}
