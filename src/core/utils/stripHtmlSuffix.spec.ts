import { expect, test } from 'vitest'
import { stripHtmlSuffix } from './stripHtmlSuffix'

test('stripHtmlSuffix', () => {
  const cases = {
    '': '',
    '/': '/',
    'index.html': '/',
    'foo.html': '/foo',
    '/index.html': '/',
    '/foo.html': '/foo',
    '/?a=b': '/?a=b',
    '/index.html?a=b': '/?a=b',
    '/foo.html?a=b': '/foo?a=b',
  }

  for (const [input, output] of Object.entries(cases)) {
    expect({ input, output: stripHtmlSuffix(input) }).toEqual({ input, output })
  }
})
