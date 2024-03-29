import { prompt } from '@utils/node/prompt'
import { MutableSecretSource } from '../types'

export async function selectSource(
  sources: MutableSecretSource[]
): Promise<MutableSecretSource | undefined> {
  if (!sources.length) {
    throw Error('[saus] None of your deploy plugins allow editing secrets.')
  }
  if (sources.length > 1) {
    const selection = await prompt({
      name: 'source',
      type: 'select',
      choices: sources.map(s => ({ title: s.name, value: s })),
    })
    return selection?.source
  }
  return sources[0]
}
