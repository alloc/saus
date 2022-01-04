import { Fragment } from 'react'
import { scrapedText } from '../state'

export default function Pokemon({ name }: { name: string }) {
  const { sections } = scrapedText.get(name)
  return (
    <div className="pokemon">
      <h1>{name[0].toUpperCase() + name.slice(1)}</h1>
      <a href={import.meta.env.BASE_URL}>Go back</a>
      <img src={'/' + name + '.webp'} crossOrigin="anonymous" />
      <div className="content">
        {sections.map((section, i) => (
          <Fragment key={i}>
            <h2>{section.title}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
