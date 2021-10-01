import fs from 'fs'
import { resolve } from 'path'
import yaml from 'yaml'
import { Logger } from 'vite'

export interface stiteConfig {
  routes: string
  render: string
}

const stiteYamlFile = 'stite.yaml'

export function readstiteYaml(root: string, logger: Logger) {
  let config: stiteConfig
  try {
    config = yaml.parse(fs.readFileSync(resolve(root, stiteYamlFile), 'utf8'))
  } catch (e: any) {
    logger.error(
      `Failed to load "${stiteYamlFile}"` +
        (e.message && e.code !== 'ENOENT' ? `: ${e.message}` : ''),
      { error: e }
    )
    process.exit(1)
  }
  config.routes = resolve(root, config.routes)
  config.render = resolve(root, config.render)
  return config
}
