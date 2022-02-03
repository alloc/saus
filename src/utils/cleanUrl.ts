const urlToPathRE = /[#?].+$/

export const cleanUrl = (url: string): string =>
  url.replace(urlToPathRE, '')
