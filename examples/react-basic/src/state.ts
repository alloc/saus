import { $, createVisitor } from '@saus/html'
import { defineStateModule } from 'saus/client'
import { get } from 'saus/http'

const wikiBaseUrl = `https://pokemon.fandom.com`

/**
 * Scrape paragraphs about the physiology and behavior of
 * each pokemon.
 */
export const scrapedText = defineStateModule(
  'scrapedText',
  async (name: string) => {
    const sections: { title: string; body: string[] }[] = []

    const wikiUrl = `${wikiBaseUrl}/wiki/${name}`
    const wikiHtml = (await get(wikiUrl)).toString('utf8')

    const isHeading = $('h1, h2, h3')
    const process = createVisitor<void>(
      $('#Physiology, #Behavior', async heading => {
        heading = heading.parentPath!
        const siblings = heading.parentPath!.children()
        const headingIndex = siblings.indexOf(heading)
        const nextHeadingIndex = siblings.findIndex(
          (sibling, i) => i > headingIndex && isHeading(sibling)
        )
        const paragraphs = siblings.slice(headingIndex + 1, nextHeadingIndex)
        sections.push({
          title: heading.innerHTML,
          body: await Promise.all(
            paragraphs.map(p => processParagraph(p.toString()))
          ),
        })
      })
    )

    await process(wikiHtml)
    return { sections }
  }
)

async function processParagraph(html: string) {
  const process = createVisitor<void>([
    // Lazy loading is not implemented, so load images immediately.
    $('img.lazyload', img => {
      const src = img.attributes['data-src'] as string
      img.attributes.src = src.replace(/\/revision\/.*$/, '')
      img.removeAttribute('data-src')
      img.removeAttribute('width')
      img.removeAttribute('height')
    }),
    // Prepend the Fandom hostname to links.
    $('a', anchor => {
      const href = anchor.attributes.href as string
      if (href && href.startsWith('/')) {
        anchor.attributes.href = wikiBaseUrl + anchor.attributes.href
      }
    }),
    // Remove <figure> elements.
    $('figure', node => {
      node.remove()
    }),
  ])
  return process(html)
}
