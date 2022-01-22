import MagicString from 'magic-string'
import path from 'path'
import { coreDir, runtimeDir } from '../bundle/constants'
import { vite } from '../core'

/**
 * Allow `import('https://foo.com/bar.js')` calls to work as expected.
 * Both JSON and JavaScript modules are supported.
 */
export function rewriteHttpImports(
  logger: vite.Logger,
  skipJsImport?: boolean
): vite.Plugin {
  const modulesId = path.join(runtimeDir, 'modules.ts')

  return {
    name: 'saus:rewriteHttpImports',
    enforce: 'post',
    async transform(code, id) {
      if (id == modulesId || id.includes('/node_modules/')) {
        return
      }

      const dynamicImportRE = /\bimport\(\s*["']([^"']+)["']\s*\)/g

      let needsHttpImport = false
      let needsJsonImport = false

      let editor: MagicString | undefined
      let match: RegExpMatchArray | null
      while ((match = dynamicImportRE.exec(code))) {
        const resolved = await this.resolve(match[1], id)
        if (resolved && /^https?:\/\//.test(resolved.id)) {
          let callee: string | undefined

          const ext = path.extname(resolved.id)
          if (ext == '.js') {
            if (skipJsImport) {
              continue
            }
            needsHttpImport = true
            callee = 'httpImport'
          } else if (ext == '.json') {
            needsJsonImport = true
            callee = 'jsonImport'
          }

          if (callee) {
            const index = match.index!
            editor ||= new MagicString(code)
            editor.overwrite(
              index,
              index + match[0].length,
              callee + `("${resolved.id}")`
            )
          } else {
            logger.warnOnce(
              `Dynamic import of "${resolved.id}" has an unsupported file type`
            )
          }
        }
      }

      if (editor) {
        const imports: string[] = []
        if (needsHttpImport) {
          const source = `/@fs/${path.join(runtimeDir, 'httpImport.ts')}`
          imports.push(`import { httpImport } from "${source}"\n`)
        }
        if (needsJsonImport) {
          const source = `/@fs/${path.join(coreDir, 'jsonImport.ts')}`
          imports.push(`import { jsonImport } from "${source}"\n`)
        }
        editor.prepend(imports.join(''))
        return {
          code: editor.toString(),
          map: editor.generateMap({ hires: true }),
        }
      }
    },
  }
}