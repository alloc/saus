export let bar1 = 1,
  bar2 = 2

export const bar3 = 3

export function update() {
  bar1++
  bar2++
}

setInterval(update, 1)
