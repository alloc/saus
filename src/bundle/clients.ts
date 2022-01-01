import { warnOnce } from 'misty'
import path from 'path'
import terser from 'terser'
import { BundleOptions } from '../bundle'
import { ClientFunctions, mapClientFunctions } from '../core'
import { UserConfig, vite } from '../core/vite'
import { parseImports } from '../utils/imports'
import { createModuleProvider } from './moduleProvider'
import type { RuntimeConfig } from './runtime/config'
import { ClientModuleMap } from './runtime/modules'
import { isCSSRequest } from './runtime/utils'
import { ClientModule } from './types'

const ID_PREFIX = 'import:'

export type ClientImport = {
  /** The unresolved module ID */
  id: string
  /** The import declaration with resolved source */
  code: string
  /** The resolved source */
  source: string
  /** The resolved source is generated on-demand */
  isVirtual?: boolean
  /** When true, this import was injected by Saus or a renderer package */
  isImplicit?: boolean
}

export async function generateClientModules(
  functions: ClientFunctions,
  importMap: Record<string, ClientImport>,
  { assetsDir, base }: RuntimeConfig,
  config: UserConfig,
  options: BundleOptions
): Promise<ClientModuleMap> {
  const input: string[] = []
  const modules = createModuleProvider()

  const imports = Object.values(importMap)
  for (let { id, code } of imports) {
    let redirectedId: string | undefined

    // Convert `import` keyword to `export` so Rollup doesn't
    // tree-shake the imported bindings, which strangely happens
    // even though we set `moduleSideEffects` to "no-treeshake".
    code = code.replace(
      /^import (.+) from (".+")/gm,
      (text, imported, source) => {
        if (imported[0] !== '{') {
          if (imported[0] !== '*') {
            return text + `; export default ${imported}`
          }
          redirectedId = source.slice(1, -1)
        }
        return `export ${imported} from ${source}`
      }
    )

    if (redirectedId) {
      input.push(redirectedId)
      continue
    }

    // Multiple statements may import from the same module,
    // so we have to deduplicate their identifiers.
    id = ID_PREFIX + id
    while (input.includes(id)) {
      id = id.replace(/(\d+)?$/, i => (i ? Number(i) + 1 + '' : ':2'))
    }

    input.push(id)
    modules.addModule({
      id,
      code,
      moduleSideEffects: 'no-treeshake',
    })
  }

  const clientConfig = config.saus.client || {}
  const minify =
    (options.minify == null ? clientConfig.minify : options.minify) !== false

  config = vite.mergeConfig(config, <vite.UserConfig>{
    plugins: [modules, fixChunkImports()],
    css: {
      minify,
    },
    build: {
      write: false,
      target: clientConfig.target || 'modules',
      minify: false,
      rollupOptions: {
        input,
        output: {
          minifyInternalExports: false,
        },
        preserveEntrySignatures: 'allow-extension',
      },
    },
  }) as UserConfig

  const buildResult = (await vite.build(config)) as vite.ViteBuild
  const { output } = buildResult.output[0]

  type OutputArray = vite.RollupOutput['output']
  type OutputChunk = OutputArray[0] & { lines?: string[] }
  type OutputAsset = Exclude<OutputArray[number], OutputChunk>

  const entryChunks: OutputChunk[] = []
  const chunks: OutputChunk[] = []
  const assets: OutputAsset[] = []

  output.forEach((chunk: OutputChunk | OutputAsset) => {
    if (chunk.type !== 'chunk') {
      assets.push(chunk)
    } else {
      chunks.push(chunk)
      if (chunk.isEntry) {
        const code = rewriteExports(chunk.code)
        const lines = code.trim().split('\n')

        // We want to preserve the `export` statements if
        // this chunk *cannot* be inlined, which is the case
        // when it consists of more than just imports.
        if (lines.every(line => line.startsWith('import '))) {
          chunk.code = code
          chunk.lines = lines
          chunk.exports = []
        }

        entryChunks.push(chunk)
      }
    }
  })

  const unresolvedImports = Object.keys(importMap)
  mapClientFunctions(functions, fn => {
    const updates: (() => void)[] = []
    fn.referenced.forEach((stmt, i) => {
      if (!stmt.startsWith('import ')) return
      const importStmt = importMap[stmt]
      if (importStmt && !importStmt.isImplicit) {
        const index = unresolvedImports.indexOf(stmt)
        const chunk = entryChunks[index]
        if (chunk.lines) {
          const inlinedImports = chunk.lines.map(stmt => {
            return stmt.replace(/"([^"]+)"/, (_, source) =>
              quotes(base + path.join(assetsDir, source))
            )
          })
          updates.push(() => {
            fn.referenced.splice(i, 1, ...inlinedImports)
          })
        } else {
          updates.push(() => {
            fn.referenced[i] = stmt.replace(
              quotes(importStmt.id),
              quotes(base + chunk.fileName)
            )
          })
        }
      } else {
        warnOnce(`Import not resolved: "${stmt}"`)
      }
    })
    for (const update of updates.reverse()) {
      update()
    }
  })

  const moduleMap: ClientModuleMap = {}

  let entryIndex = -1
  await Promise.all(
    chunks.map(async chunk => {
      let key = chunk.fileName
      if (chunk.isEntry) {
        const importStmt = imports[++entryIndex]
        if (!importStmt) {
          return warnOnce(`Unexpected entry module: "${chunk.fileName}"`)
        }
        if (importStmt.code.includes('* as routeModule ')) {
          key = importStmt.source
        } else if (importStmt.isImplicit) {
          key = unresolvedImports[entryIndex]
        } else {
          key = importStmt.code.replace(
            quotes(importStmt.source),
            quotes(base + chunk.fileName)
          )
        }
      }

      // Convert relative imports to absolute imports, because we'll want
      // to inline the chunk if it only consists of import statements.
      for (const { source } of parseImports(chunk.code).reverse()) {
        chunk.code =
          chunk.code.slice(0, source.start) +
          (base + path.join(assetsDir, source.value)) +
          chunk.code.slice(source.end)
      }

      if (minify) {
        const minified = await terser.minify(chunk.code, {
          toplevel: chunk.exports.length > 0,
          keep_fnames: true,
          keep_classnames: true,
        })
        chunk.code = minified.code!
      }

      const mod: ClientModule = (moduleMap[key] = {
        id: chunk.fileName,
        text: chunk.code,
      })

      if (chunk.imports.length) {
        mod.imports = chunk.imports
      }
      if (chunk.exports.length) {
        mod.exports = chunk.exports
      }
    })
  )

  // TODO: encode image/video/audio files with base64?
  assets.forEach(asset => {
    moduleMap[asset.fileName] = {
      id: asset.fileName,
      text: Buffer.from(asset.source).toString('utf8'),
    }
  })

  return moduleMap
}

function quotes(text: string) {
  return `"${text}"`
}

/**
 * Convert the given module text to have no exports. Rollup doesn't play well
 * with entry modules that don't export anything, so we have to convert the
 * imports to exports and back again once bundled.
 *
 * Remove `export` statements if they have no `from` keyword. If they do have
 * a `from` keyword, but also contain a `default` keyword, remove them still.
 * For any remaining export statements, rewrite them to be import statements.
 */
function rewriteExports(text: string) {
  return text
    .replace(/^export \{ [\w$]+ as default \} from "[^"]+";?$/gm, '')
    .replace(/^export \{ [^}]+ \};?$/gm, '')
    .replace(/^export /gm, 'import ')
    .trim()
}

/**
 * Vite removes `.css` and other assets from the `imports` array
 * of each rendered JS chunk, but the SSR bundles still needs those
 * imports to be tracked.
 */
function fixChunkImports(): vite.Plugin {
  return {
    name: 'saus:fixChunkImports',
    enforce: 'post',
    configResolved(config) {
      this.generateBundle = (_, bundle) => {
        for (const id in bundle) {
          const chunk = bundle[id]
          if (chunk.type == 'chunk') {
            config.chunkToEmittedCssFileMap.get(chunk)?.forEach(fileName => {
              chunk.imports.push(fileName)
            })
            config.chunkToEmittedAssetsMap.get(chunk)?.forEach(fileName => {
              chunk.imports.push(fileName)
            })
          }
        }
      }
    },
  }
}
