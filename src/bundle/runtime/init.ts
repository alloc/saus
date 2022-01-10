const steps: (() => any)[] = []

export default function (step: () => any) {
  steps.push(step)
  if (steps.length == 1)
    setImmediate(async () => {
      for (const step of steps) {
        await step()
      }
      steps.length = 0
    })
}
