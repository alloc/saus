import cac from 'cac'
import * as inspector from 'inspector'
import * as actions from './cli/actions'
import { useCommands } from './cli/command'

declare const globalThis: any
if (inspector.url()) {
  globalThis.__inspectorActive = true
}

declare const __VERSION__: string

const cli = cac('saus')
useCommands(cli, actions)

cli.help()
cli.version(__VERSION__)

export default cli
