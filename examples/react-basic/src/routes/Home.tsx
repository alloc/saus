import pokemon from '../../data/pokemon.json'
import { Link } from '../components/Link'

export default function Home() {
  return (
    <>
      <h1>Home</h1>
      <div>
        {pokemon.map((name, i) => (
          <Link key={i} href={'/pokemon/' + name.toLowerCase()}>
            {name}
          </Link>
        ))}
        <Link href="/broken-link">404 Test</Link>
      </div>
    </>
  )
}
