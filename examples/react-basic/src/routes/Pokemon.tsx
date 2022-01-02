export default function Pokemon({ name }: { name: string }) {
  return (
    <div className="pokemon">
      <h1>{name[0].toUpperCase() + name.slice(1)}</h1>
      <a href={import.meta.env.BASE_URL}>Go back</a>
      <img
        src={import.meta.env.BASE_URL + name + '.webp'}
        crossOrigin="anonymous"
      />
    </div>
  )
}
