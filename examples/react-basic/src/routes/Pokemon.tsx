import { Link } from '../components/Link'
import { scrapedText } from '../state'
import { prependBase } from '../url'
import './Pokemon.css'

export default function Pokemon({ name }: { name: string }) {
  const { sections } = scrapedText.get(name)
  return (
    <div className="pokemon">
      <h1>{name[0].toUpperCase() + name.slice(1)}</h1>
      <Link href="/">Go back</Link>
      <div className="content">
        <img src={prependBase(name + '.webp')} crossOrigin="anonymous" />
        <div
          className="sections"
          dangerouslySetInnerHTML={{
            __html: sections
              .map(section => {
                return `<h2>${section.title}</h2>` + section.body.join('')
              })
              .join(''),
          }}
        />
      </div>
    </div>
  )
}
