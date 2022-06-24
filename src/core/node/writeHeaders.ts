type ResponseLike = { setHeader(name: string, value: string | string[]): void }

export function writeHeaders(
  res: ResponseLike,
  headers: Record<string, string | string[] | undefined>
) {
  for (const name in headers) {
    const value = headers[name]
    if (value !== undefined) {
      res.setHeader(name, value)
    }
  }
}
