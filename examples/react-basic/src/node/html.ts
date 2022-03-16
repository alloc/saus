import { downloadRemoteAssets } from '@saus/html'
import { MistyTask, startTask } from 'misty/task'
import { success } from 'misty'

export default (options: { cacheAssets: boolean }) => {
  if (options.cacheAssets) {
    const tasks = new Map<string, MistyTask>()
    downloadRemoteAssets({
      onRequest: url => {
        tasks.set(url, startTask(`Downloading: ${url}`))
      },
      onResponse: url => {
        tasks.get(url)!.finish()
        tasks.delete(url)
      },
      onWriteFile: file => {
        success(`Saved asset: ${file}`)
      },
    })
  }
}
