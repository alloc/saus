import pokemon from '../../data/pokemon.json'

export default function Home() {
  return (
    <>
      <h1>Home</h1>
      {pokemon.map((p, i) => (
        <a key={i} href={'/pokemon/' + p.name}>
          {p.name}
        </a>
      ))}
    </>
  )
}
