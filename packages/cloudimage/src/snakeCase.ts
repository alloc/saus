export const snakeCase = (text: string) =>
  text
    .replace(/^[A-Z]/, ch => ch.toLowerCase())
    .replace(/[A-Z]+/g, text => '_' + text.toLowerCase())
