export default function(namespace: string) {
  return (msg: string) => console.debug(`[${namespace}] ${msg}`)
}
