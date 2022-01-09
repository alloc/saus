import { $, createVisitor } from '@saus/html'
import { defineStateModule } from 'saus/client'
import { get } from 'saus/core'

/**
 * Scrape paragraphs about the physiology and behavior of
 * each pokemon.
 */
export const scrapedText = defineStateModule(
  'scrapedText',
  async (name: string) => {
    const sections: { title: string; body: string[] }[] = []

    const wikiUrl = `https://pokemon.fandom.com/wiki/${name}`
    const wikiHtml = (await get(wikiUrl)).toString('utf8')

    const isHeading = $('h1, h2, h3')
    const process = createVisitor<void>(
      $('#Physiology, #Behavior', heading => {
        const siblings = heading.parentPath!.children()
        const headingIndex = siblings.indexOf(heading)
        const nextHeadingIndex = siblings.findIndex(
          (sibling, i) => i > headingIndex && isHeading(sibling)
        )
        const paragraphs = siblings.slice(headingIndex + 1, nextHeadingIndex)
        sections.push({
          title: heading.innerHTML,
          body: paragraphs.map(p => p.innerHTML),
        })
      })
    )

    await process(wikiHtml)
    return { sections }
  }
)
