import pokemon from '../../data/pokemon.json'

export default function Home() {
  return (
    <>
      <h1>Home</h1>
      <div>
        {pokemon.map((name, i) => (
          <a key={i} href={'/pokemon/' + name.toLowerCase()}>
            {name}
          </a>
        ))}
        <a href="/broken-link">404 Test</a>
      </div>
    </>
  )
}
