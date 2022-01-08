import { defineStateModule } from 'saus/client'
import { get } from 'saus/core'
import cheerio from 'cheerio'

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
    const $ = cheerio.load(wikiHtml)

    $('#Physiology, #Behavior')
      .parent()
      .each((_, heading) => {
        const siblings = $(heading).parent().children().toArray()
        const headingIndex = siblings.indexOf(heading)
        const nextHeadingIndex = siblings.findIndex(
          (sibling, i) => i > headingIndex && $(sibling).is('h1, h2, h3')
        )
        const paragraphs = siblings.slice(headingIndex + 1, nextHeadingIndex)
        sections.push({
          title: $(heading).text(),
          body: paragraphs.map(p => $(p).text()),
        })
      })

    return { sections }
  }
)
