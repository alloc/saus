export default function Pokemon({ name }: { name: string }) {
  return (
    <div className="pokemon">
      <h1>{name}</h1>
      <a href="/">Go back</a>
      <img src={'/' + name + '.webp'} crossOrigin="anonymous" />
    </div>
  )
}
