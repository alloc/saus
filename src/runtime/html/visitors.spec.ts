import { describe, expect, fn, it } from 'vitest'
import { traverse } from './test'
import { HtmlComment, HtmlTagPath, HtmlText } from './types'

describe('HTML visitors', () => {
  it.only('calls "open" and "close" handlers', async () => {
    const visitor = { open: fn(), close: fn() }
    await traverse(`<div><div/></div>`, visitor)

    // Each handler is called 1 more time than expected,
    // because an implicit <html> tag is inserted.
    expect(visitor.open).toBeCalledTimes(3)
    expect(visitor.close).toBeCalledTimes(3)
  })

  describe('path.skip', () => {
    it('skips the current visitor until the skipped path is closed', async () => {
      await traverse(
        `<div><div/></div>
         <div><div/></div>`,
        {
          open(path) {
            if (path.tagName !== 'html') {
              path.skip()
              expect(path.parentPath?.tagName).toBe('html')
            }
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
      expect(result).toMatchInlineSnapshot(`
"
<html><div><span/></div>
</html>"`)
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
      expect(result).toMatchInlineSnapshot(`
"
<html><body>foo</body>
</html>"`)
    })
  })

  describe('path.appendChild', () => {
    it('appends a string to the end of the tag body', async () => {
      const result = await traverse(`<div>xyz</div>`, {
        div(path) {
          path.appendChild('foo')
        },
      })
      expect(result).toMatchInlineSnapshot(`
"
<html><div>xyzfoo</div>
</html>"`)
    })

    it('puts the string of the most recent appendChild call last', async () => {
      const result = await traverse(`<div>xyz</div>`, {
        div(path) {
          path.appendChild('foo')
          path.appendChild('bar')
        },
      })
      expect(result).toMatchInlineSnapshot(`
"
<html><div>xyzfoobar</div>
</html>"`)
    })

    it('is equivalent to insertChild with max index', async () => {
      const result = await traverse(`<div>xyz</div>`, {
        div(path) {
          path.appendChild('foo')
          path.insertChild(Infinity, 'bar')
        },
      })
      expect(result).toMatchInlineSnapshot(`
"
<html><div>xyzfoobar</div>
</html>"`)
    })

    it('works with self-closing tag', async () => {
      const result = await traverse(`<div/>`, {
        div(path) {
          path.appendChild('foo')
        },
      })
      expect(result).toMatchInlineSnapshot(`
"
<html><div>foo</div>
</html>"`)
    })

    it('always puts the string after prependChild calls', async () => {
      const result = await traverse(`<div/>`, {
        div(path) {
          path.appendChild('bar')
          path.prependChild('foo')
        },
      })
      expect(result).toMatchInlineSnapshot(`
"
<html><div>foobar</div>
</html>"`)
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
      expect(result).toMatchInlineSnapshot(`
"
<html><div>foobarxyz</div>
</html>"`)
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
      expect(result).toMatchInlineSnapshot(`
"
<html><div>foobarxyzfoobar</div>
</html>"`)
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
      expect(result).toMatchInlineSnapshot(`
"
<html><div defer foo>xyz</div>
</html>"`)
    })

    it('works with self-closing tag', async () => {
      const result = await traverse(`<div/>`, {
        div(path) {
          path.setAttribute('foo', 'bar')
        },
      })
      expect(result).toMatchInlineSnapshot(`
"
<html><div foo=\\"bar\\" />
</html>"`)
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
      expect(result).toMatchInlineSnapshot(`
"
<html><div></div>
</html>"`)
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
"
<html><div class=\\"foo\\">hello</div>
         <div class=\\"bar\\" />
</html>"`)
    })

    it('can mutate text content', async () => {
      const result = await traverse(`<div class="foo">hello</div>`, {
        div(path) {
          const text = path.node.body![0] as HtmlText
          text.value += ' world'
        },
      })
      expect(result).toMatchInlineSnapshot(
        `
"
<html><div class=\\"foo\\">hello</div>
</html>"`
      )
    })

    it('can mutate a comment tag', async () => {
      const result = await traverse(`<!-- test -->`, {
        html(path) {
          const comment = path.node.body![0] as HtmlComment
          comment.value = 'changed'
        },
      })
      expect(result).toMatchInlineSnapshot(`
"
<html><!--changed-->
</html>"`)
    })

    it('can mutate an attribute value', async () => {
      const result = await traverse(`<div class="foo"/>`, {
        div(path) {
          path.node.attributes[0].value!.value = 'bar'
        },
      })
      expect(result).toMatchInlineSnapshot(`
"
<html><div class=\\"foo\\"/>
</html>"`)
    })
  })
})
