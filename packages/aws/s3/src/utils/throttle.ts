import { ExecutionGate } from 'saus/utils/controlExecution'

// https://aws.amazon.com/premiumsupport/knowledge-center/s3-request-limit-avoid-throttling/
const maxWritesPerSecond = 3500

let writes = 0
let writesPerSecond = 0
let timeout: NodeJS.Timeout | null = null

export const writeThrottler: ExecutionGate = async (ctx, args) => {
  if (writesPerSecond == maxWritesPerSecond) {
    ctx.queuedCalls.push(args)
  } else {
    writes++
    writesPerSecond++
    timeout ||= setTimeout(() => {
      writesPerSecond = writes
    }, 1000)

    await ctx.execute(args)
    writes--
  }
}
