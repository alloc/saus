import pokemon from '../../data/pokemon.json'

export default function Pokemon({ name }: { name: string }) {
  const { image } = pokemon.find(p => p.name == name)!
  return (
    <>
      <h1>{name}</h1>
      <a href="/">Go back</a>
      <img src={image} />
    </>
  )
}
