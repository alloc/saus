export class HttpRedirect {
  constructor(readonly location: string) {}
}

/**
 * Define an external URL to load a module or asset from.
 */
export function httpRedirect(location: string) {
  return new HttpRedirect(location)
}
