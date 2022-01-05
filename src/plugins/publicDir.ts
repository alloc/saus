import fs from 'fs'
import path from 'path'
import { Plugin } from '../core'

/**
 * Copy files from `publicDir` into the `build.outDir` directory,
 * as defined in your Vite config.
 *
 * The `saus build` command uses this plugin by default, while the
 * `saus bundle` command does not.
 */
export function copyPublicDir(): Plugin {
  let publicDir: string | false
  let outDir: string

  function copyPublicFiles() {
    if (publicDir && fs.existsSync(publicDir)) {
      copyDir(publicDir, outDir)
    }
  }

  return {
    name: copyPublicDir.name,
    apply: 'build',
    saus: {
      onContext(context) {
        outDir = context.config.build?.outDir ?? 'dist'
        publicDir = context.config.publicDir ?? 'public'
        if (publicDir) {
          publicDir = path.resolve(context.root, publicDir)
        }
      },
      onWriteBundle: copyPublicFiles,
      onWritePages: copyPublicFiles,
    },
  }
}

function copyDir(srcDir: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true })
  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = path.resolve(srcDir, file)
    if (srcFile === destDir) {
      continue
    }
    const destFile = path.resolve(destDir, file)
    const stat = fs.statSync(srcFile)
    if (stat.isDirectory()) {
      copyDir(srcFile, destFile)
    } else {
      fs.copyFileSync(srcFile, destFile)
    }
  }
}
