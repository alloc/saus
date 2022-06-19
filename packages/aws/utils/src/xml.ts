import { escape } from 'saus/core'
import { parseXML } from './xml/parse'

export interface XmlDocument {
  /** Add a self-closing tag. */
  append(tag: string, attrs?: Record<string, any>): XmlDocument
  /** Open a tag with children. */
  open(tag: string, attrs?: Record<string, any>): XmlDocument
  /** Convenience method for defining a list of nodes within another tag. */
  list(
    callback: (
      open: (tag: string, attrs?: Record<string, any>) => XmlDocument
    ) => void
  ): XmlDocument
  /** Use an object to define child nodes with text content. */
  props(contentByTag: Record<string, any>): XmlDocument
  /** Close the last opened tag. */
  close(): XmlDocument
  /** Get the formatted XML string. */
  toString(): string
}

export function xml(encoding = 'UTF-8'): XmlDocument {
  let text = `<?xml version="1.0" encoding="${encoding}"?>\n`
  let tagStack: string[] = []

  function openTag(name: string, attrs?: Record<string, any>) {
    tagStack.push(name)
    text += '<' + name
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        text += ` ${key}="${escape(value)}"`
      }
    }
  }

  return {
    append(tag, attrs) {
      openTag(tag, attrs)
      text += '/>'
      return this
    },
    open(tag, attrs) {
      openTag(tag, attrs)
      text += '>'
      return this
    },
    list(callback) {
      let hasOpened = false
      callback((tag, attrs) => {
        if (hasOpened) {
          this.close()
        } else {
          hasOpened = true
        }
        return this.open(tag, attrs)
      })
      if (hasOpened) {
        this.close()
      }
      return this
    },
    props(props) {
      for (const [key, value] of Object.entries(props)) {
        this.open(key)
        text += value
        this.close()
      }
      return this
    },
    close() {
      const tag = tagStack.pop()
      if (tag) {
        text += '</' + tag + '>'
      }
      return this
    },
    toString() {
      return text
    },
  }
}

xml.parse = parseXML
