import type { Plugin } from '@/core'
import * as esModuleLexer from 'es-module-lexer'
import MagicString from 'magic-string'

/**
 * Register all imports with `trackSecretDependencies` so that we can
 * bail out early when a required secret is missing.
 */
export function secretsPlugin(deployPath: string): Plugin {
  return {
    name: 'saus:secrets',
    enforce: 'pre',
    transform(code, id) {
      if (id !== deployPath) {
        return
      }

      const [imports] = esModuleLexer.parse(code)
      if (!imports.length) {
        return
      }

      const importNames: string[] = []
      for (const i of imports) {
        if (~i.d || !i.n) continue
        if (/^saus(\/|$)/.test(i.n)) continue

        // Get all import aliases.
        const aliases = /\{([^}]+)\}/
          .exec(code.substring(i.ss, i.se).replace(/\b[^,]+ as,/g, ''))![1]
          .trim()
          .split(/[ ,]+/g)

        importNames.push(...aliases)
      }

      const lastImportEnd = imports[imports.length - 1].se + 1
      const trackedVars = importNames.map(name => '  ' + name).join(',\n')

      const editor = new MagicString(code)
      editor.appendLeft(
        lastImportEnd,
        `import {checkSecrets} from "saus/deploy";\n` +
          `checkSecrets([${trackedVars}]);`
      )

      return {
        code: editor.toString(),
        map: editor.generateMap(),
      }
    },
  }
}
