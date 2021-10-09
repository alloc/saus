import fs from 'fs'
import { resolve } from 'path'
import yaml from 'yaml'
import { Logger } from 'vite'

export interface sausConfig {
  routes: string
  render: string
}

const sausYamlFile = 'saus.yaml'

export function readSausYaml(root: string, logger: Logger) {
  let config: sausConfig
  try {
    config = yaml.parse(fs.readFileSync(resolve(root, sausYamlFile), 'utf8'))
  } catch (e: any) {
    logger.error(
      `Failed to load "${sausYamlFile}"` +
        (e.message && e.code !== 'ENOENT' ? `: ${e.message}` : ''),
      { error: e }
    )
    process.exit(1)
  }
  config.routes = resolve(root, config.routes)
  config.render = resolve(root, config.render)
  return config
}
