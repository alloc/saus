export function onShortcut(
  stdin: NodeJS.ReadStream,
  handler: (key: string, resume: () => void) => void
): void {
  stdin
    .setRawMode(true)
    .setEncoding('utf8')
    .once('data', data => {
      stdin.pause()
      handler(String(data || ''), () => {
        onShortcut(stdin, handler)
      })
    })
    .resume()
}
