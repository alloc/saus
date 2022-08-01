export class HttpRedirect {
  constructor(readonly location: string, readonly status = 308) {}
}

/**
 * Define an external URL to load a module or asset from.
 *
 * Pass true as the `temp` argument to use 307 for the status code.
 */
export function httpRedirect(location: string, temp?: boolean) {
  return new HttpRedirect(location, temp ? 307 : 308)
}
