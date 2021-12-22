const debugEnv = process.env['DEBUG']
const debugPatterns = debugEnv
  ? debugEnv
      .split(' ')
      .map(p => new RegExp(p.replace(/:\*/g, '(:.+)?').replace(/\*/g, '.+')))
  : []

export default function (namespace: string) {
  return debugPatterns.some(p => p.test(namespace))
    ? (msg: string) => console.debug(`[${namespace}] ${msg}`)
    : () => {}
}
