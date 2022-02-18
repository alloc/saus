export let baz1 = 1
export const baz2 = 2

setInterval(() => {
  baz1++
}, 1)

export * from './circular'
