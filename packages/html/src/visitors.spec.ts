import { describe, expect, fn, it } from 'vitest'
import { traverse } from './test'
import { HtmlTagPath, HtmlText } from './types'

describe('HTML visitors', () => {
  it('calls "open" and "close" handlers', async () => {
    const visitor = { open: fn(), close: fn() }
    await traverse(`<div><div/></div>`, visitor)

    expect(visitor.open).toBeCalledTimes(2)
    expect(visitor.close).toBeCalledTimes(2)
  })

  describe('path.skip', () => {
    it('skips the current visitor until the skipped path is closed', async () => {
      await traverse(
        `<div><div/></div>
         <div><div/></div>`,
        {
          open(path) {
            path.skip()
            expect(path.parentPath).toBeUndefined()
          },
        }
      )
      expect.assertions(2)
    })

    it('does not affect other visitors', async () => {
      const visitor1 = {
        open: (path: HtmlTagPath) => path.skip(),
      }
      const visitor2 = {
        open: fn(),
      }
      await traverse(`<div><div/></div>`, [visitor1, visitor2])
      expect(visitor2.open).toBeCalledTimes(2)
    })
  })

  describe('path.remove', () => {
    it('removes a subtree', async () => {
      const result = await traverse(`<div><span/><span/></div>`, {
        span(path) {
          path.remove()
        },
      })
      expect(result).toMatchInlineSnapshot('"<div></div>"')
    })

    it('stops further traversal by all visitors', async () => {
      const visitor1 = {
        div: (path: HtmlTagPath) => path.remove(),
        span: fn(),
      }
      const visitor2 = {
        span: fn(),
      }
      await traverse(`<div><span/></div>`, [visitor1, visitor2])
      expect(visitor1.span).not.toBeCalled()
      expect(visitor2.span).not.toBeCalled()
    })
  })

  describe('path.replace', () => {
    it('overwrites the tag with a string', async () => {
      const result = await traverse(`<body><div>xyz</div></body>`, {
        div(path) {
          path.replace('foo')
        },
      })
      expect(result).toMatchInlineSnapshot('"<body>foo</body>"')
    })
  })

  describe('path.appendChild', () => {
    it('appends a string to the end of the tag body', async () => {
      const result = await traverse(`<div>xyz</div>`, {
        div(path) {
          path.appendChild('foo')
        },
      })
      expect(result).toMatchInlineSnapshot('"<div>xyzfoo</div>"')
    })

    it('puts the string of the most recent appendChild call last', async () => {
      const result = await traverse(`<div>xyz</div>`, {
        div(path) {
          path.appendChild('foo')
          path.appendChild('bar')
        },
      })
      expect(result).toMatchInlineSnapshot('"<div>xyzfoobar</div>"')
    })

    it('is equivalent to insertChild with max index', async () => {
      const result = await traverse(`<div>xyz</div>`, {
        div(path) {
          path.appendChild('foo')
          path.insertChild(Infinity, 'bar')
        },
      })
      expect(result).toMatchInlineSnapshot('"<div>xyzfoobar</div>"')
    })

    it('works with self-closing tag', async () => {
      const result = await traverse(`<div/>`, {
        div(path) {
          path.appendChild('foo')
        },
      })
      expect(result).toMatchInlineSnapshot('"<div>foo</div>"')
    })

    it('always puts the string after prependChild calls', async () => {
      const result = await traverse(`<div/>`, {
        div(path) {
          path.appendChild('bar')
          path.prependChild('foo')
        },
      })
      expect(result).toMatchInlineSnapshot('"<div>foobar</div>"')
    })
  })

  describe('path.prependChild', () => {
    it('always puts the string before insertChild calls', async () => {
      const result = await traverse(`<div>xyz</div>`, {
        div(path) {
          path.insertChild(0, 'bar')
          path.prependChild('foo')
        },
      })
      expect(result).toMatchInlineSnapshot('"<div>foobarxyz</div>"')
    })
  })

  describe('path.insertChild', () => {
    it('puts the string of the most recent insertChild call last', async () => {
      const result = await traverse(`<div>xyz</div>`, {
        div(path) {
          path.insertChild(0, 'foo')
          path.insertChild(0, 'bar')
          path.insertChild(Infinity, 'foo')
          path.insertChild(Infinity, 'bar')
        },
      })
      expect(result).toMatchInlineSnapshot('"<div>foobarxyzfoobar</div>"')
    })
  })

  describe('path.setAttribute', () => {
    it('accepts boolean value', async () => {
      const result = await traverse(`<div defer>xyz</div>`, {
        div(path) {
          path.setAttribute('foo', true)
          path.setAttribute('defer', false)
        },
      })
      expect(result).toMatchInlineSnapshot('"<div foo>xyz</div>"')
    })

    it('works with self-closing tag', async () => {
      const result = await traverse(`<div/>`, {
        div(path) {
          path.setAttribute('foo', 'bar')
        },
      })
      expect(result).toMatchInlineSnapshot('"<div foo=\\"bar\\" />"')
    })
  })

  describe('path.innerHTML', () => {
    it('returns the original inner HTML before any changes', async () => {
      await traverse(`<div>Hello <b>world</b></div>`, {
        div(path) {
          expect(path.innerHTML).toMatchInlineSnapshot('"Hello <b>world</b>"')
        },
      })
    })

    it('is mutable', async () => {
      const boldSpy = fn()
      const result = await traverse(`<div>Hello <b>world</b></div>`, {
        b: boldSpy,
        div(path) {
          path.innerHTML = ''
        },
      })
      expect(result).toMatchInlineSnapshot('"<div></div>"')
      // Replaced descendants are not traversed.
      expect(boldSpy).not.toBeCalled()
    })
  })

  describe('path.tagName', () => {
    it('is a shortcut for path.node.name', async () => {
      const result = await traverse(`<Hello />`, {
        open(path) {
          // HTML tag names are case insensitive
          expect(path.tagName).toBe('hello')
          // The setter preserves capital letters
          path.tagName = 'Foo'
        },
      })
      expect(result).toMatchInlineSnapshot('"<Foo />"')
    })
  })

  describe('direct mutation', () => {
    it('can mutate tag names', async () => {
      const result = await traverse(
        `<div class="foo">hello</div>
         <div class="bar" />`,
        {
          div(path) {
            path.node.name = 'span'
          },
        }
      )
      expect(result).toMatchInlineSnapshot(`
"<span class=\\"foo\\">hello</span>
         <span class=\\"bar\\" />"`)
    })

    it('can mutate text content', async () => {
      const result = await traverse(`<div class="foo">hello</div>`, {
        div(path) {
          const text = path.node.body![0] as HtmlText
          text.value += ' world'
        },
      })
      expect(result).toMatchInlineSnapshot(
        '"<div class=\\"foo\\">hello world</div>"'
      )
    })
  })
})
