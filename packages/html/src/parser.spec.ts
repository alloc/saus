import { formatWithOptions } from 'util'
import { describe, expect, it } from 'vitest'
import { parseHtml } from './parser'

describe('parseHtml', () => {
  it('parses tags and text', () => {
    expect(
      parseHtml('<div><br /><span>Hello</span> world</div>')
    ).toMatchSnapshot()
  })

  it('parses attributes', () => {
    expect(
      parseHtml('<div bool class="foo"><span bool/></div>')
    ).toMatchSnapshot()
  })

  it('parses implicit self-closing tags', () => {
    expect(
      parseHtml('<!DOCTYPE html><meta name="description" content="(3,3)">')
    ).toMatchSnapshot()
  })

  it('parses comments', () => {
    expect(
      parseHtml('<!----><div><!-- Hello world --></div>')
    ).toMatchSnapshot()
  })
})

// @ts-ignore
function debugHtmlParser(html: string) {
  console.log(formatWithOptions({ colors: true, depth: 100 }, parseHtml(html)))
}
