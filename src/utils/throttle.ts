export function throttle(run: (cb: () => void) => void) {
  let throttled = false
  return (cb: () => void) => {
    if (!throttled) {
      throttled = true
      run(() => {
        throttled = false
        cb()
      })
    }
  }
}
