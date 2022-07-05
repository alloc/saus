import { readdirSync, realpathSync } from 'fs'
import { join } from 'path'

export function findConfigFiles(root: string) {
  const configFiles: string[] = []
  const nodeModulesDir = join(root, 'node_modules')
  const checkPackageDir = (dir: string) => {
    const files = readDir(dir)
    const configFile = ['vite.config.ts', 'vite.config.js'].find(file =>
      files.includes(file)
    )
    if (configFile) {
      configFiles.push(realpathSync(join(dir, configFile)))
    }
  }
  for (const name of readDir(nodeModulesDir)) {
    if (name[0] == '@') {
      const scope = name
      readDir(join(nodeModulesDir, scope)).forEach(name => {
        if (/\bsaus\b/.test(scope + '/' + name)) {
          checkPackageDir(join(nodeModulesDir, scope, name))
        }
      })
    } else if (/\bsaus\b/.test(name)) {
      checkPackageDir(join(nodeModulesDir, name))
    }
  }
  return configFiles
}

function readDir(dir: string) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}
