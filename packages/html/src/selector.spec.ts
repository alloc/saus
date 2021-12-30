import { describe, expect, it, fn } from 'vitest'
import { $ } from './selector'
import { traverse } from './test'

describe('CSS selectors', () => {
  it('supports child selector', async () => {
    const callback = fn()
    await traverse(
      `<div><span /></div>
       <span />`,
      $('div > span', callback)
    )
    expect(callback).toBeCalledTimes(1)
  })

  it('supports descendant selector', async () => {
    const callback = fn()
    await traverse(
      `<main><div><span /></div></main>
       <span />`,
      $('main span', callback)
    )
    expect(callback).toBeCalledTimes(1)
  })

  it.only('supports id selector', async () => {
    const callback = fn()
    await traverse(`<div id="foo" />`, $('#foo', callback))
    expect(callback).toBeCalledTimes(1)
  })

  it.only('supports class selector', async () => {
    const callback = fn()
    await traverse(
      `<span />
       <div class="foo bar" />
       <span class="foo" />`,
      $('.foo.bar', callback)
    )
    expect(callback).toBeCalledTimes(1)
  })

  describe('attribute selectors', () => {
    it('supports equals operator', async () => {
      const callback = fn()
      await traverse(
        `<span class="foo" />
         <span class="foo2" />`,
        $('span[class="foo"]', callback)
      )
      expect(callback).toBeCalledTimes(1)
    })

    it('supports ^= operator', async () => {
      const callback = fn()
      await traverse(
        `<span class="foo1" />
         <span class="foo2" />`,
        $('span[class^="foo"]', callback)
      )
      expect(callback).toBeCalledTimes(2)
    })

    it('supports *= operator', async () => {
      const callback = fn()
      await traverse(
        `<span class="foo1" />
         <span class="foo2" />`,
        $('span[class*="oo"]', callback)
      )
      expect(callback).toBeCalledTimes(2)
    })

    it('supports $= operator', async () => {
      const callback = fn()
      await traverse(
        `<span class="ax" />
         <span class="bx" />`,
        $('span[class$="x"]', callback)
      )
      expect(callback).toBeCalledTimes(2)
    })
  })
})
