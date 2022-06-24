import { isMainThread } from 'worker_threads'
import { ClientAsset } from '../../types'

export function postProcessAsset(data: ClientAsset): ClientAsset {
  // When `data` is a Node buffer, we cannot be sure if it can
  // be safely copied between threads, since it may have been
  // allocated with `Buffer.from` (which uses object pooling).
  // An explicit copy into a non-pooled buffer is the only
  // way to make sure the data won't get corrupted.
  if (!isMainThread && Buffer.isBuffer(data)) {
    const nonPooled = Buffer.alloc(data.byteLength)
    data.copy(nonPooled)
    data = nonPooled.buffer
  }
  return data
}
