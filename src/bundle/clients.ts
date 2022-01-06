import escalade from 'escalade/sync'
import { warnOnce } from 'misty'
import path from 'path'
import stripComments from 'strip-comments'
import terser from 'terser'
import { BundleOptions } from '../bundle'
import {
  ClientFunctions,
  mapClientFunctions,
  RuntimeConfig,
  SausContext,
  UserConfig,
  vite,
} from '../core'
import { transformClientState } from '../plugins/clientState'
import { debugForbiddenImports } from '../plugins/debug'
import { routesPlugin } from '../plugins/routes'
import { parseImports } from '../utils/imports'
import { createModuleProvider } from './moduleProvider'
import { ClientModuleMap } from './runtime/modules'
import { slash } from './runtime/utils'
import { toInlineSourceMap } from './sourceMap'
import { ClientModule } from './types'

const posixPath = path.posix

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
  context: SausContext,
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

  let { config } = context

  const mode = options.mode || context.configEnv.mode
  const isProduction = mode == 'production'

  // Vite replaces `process.env.NODE_ENV` in client modules with the value
  // at compile time (strangely), so we need to reset it here.
  if (!isProduction) {
    process.env.NODE_ENV = undefined
  }

  let sourceMaps = config.build?.sourcemap ?? (!isProduction && 'inline')
  if (sourceMaps === true || sourceMaps === 'hidden') {
    sourceMaps = false
    context.logger.warn(
      '`sourceMaps: ' +
        JSON.stringify(sourceMaps) +
        '` is not supported for SSR bundles; use "inline" instead.'
    )
  }

  const outDir = path.resolve(context.root, config.build?.outDir || 'dist')
  const minify =
    options.minify == null
      ? config.build?.minify ?? isProduction
      : options.minify

  config = vite.mergeConfig(config, <vite.UserConfig>{
    plugins: [
      debugForbiddenImports([
        'vite',
        './src/core/index.ts',
        './src/core/context.ts',
      ]),
      routesPlugin(context),
      modules,
      fixChunkImports(),
      transformClientState(),
    ],
    mode,
    css: {
      minify,
    },
    build: {
      write: false,
      minify: false,
      sourcemap: sourceMaps,
      rollupOptions: {
        input,
        output: {
          dir: outDir,
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
      if (sourceMaps == 'inline' && chunk.map?.sources.length) {
        const chunkDir = path.join(outDir, path.dirname(chunk.fileName))
        chunk.map.sources = rewriteSources(chunk.map.sources, chunkDir, context)
        chunk.code += toInlineSourceMap(chunk.map)
      }
      chunks.push(chunk)
      if (chunk.isEntry) {
        const code = rewriteExports(chunk.code)
        const lines = stripComments(code).split('\n').filter(Boolean)

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

/**
 * Make sourcemap sources more useful by injecting the package name/version
 * for external modules and by rewriting paths for project files to be relative
 * to the project root.
 */
function rewriteSources(
  sources: string[],
  chunkDir: string,
  context: SausContext
) {
  const chunkDepth = chunkDir.split('/').length - 1
  const publicDir = '/' + (context.config.publicDir || 'public') + '/'

  return sources.map(sourcePath => {
    const sourceDepth = sourcePath.startsWith('../')
      ? sourcePath.replace(/\/[^./].+$/, '').split('/').length
      : 0

    // Handle imports of public files.
    if (sourceDepth == chunkDepth) {
      return publicDir + sourcePath.replace(/^(\.\.\/)+/, '')
    }

    sourcePath = path.resolve(chunkDir, sourcePath)
    let sourceId = vite.normalizePath(path.relative(context.root, sourcePath))
    if (sourceId[0] == '.' || sourceId.includes('/node_modules/')) {
      const pkgPath = escalade(
        path.dirname(sourcePath),
        (_parent, children) => {
          return children.find(name => name == 'package.json')
        }
      )
      if (pkgPath) {
        const pkg = require(pkgPath)
        sourceId = posixPath.join(
          pkg.name + '@' + pkg.version,
          slash(path.relative(path.dirname(pkgPath), sourcePath))
        )
      } else {
        // No "package.json" was found, so just remove the "../" parts.
        sourceId = sourceId.replace(/^(\.\.\/)+/, '')
      }
      return '/node_modules/' + sourceId
    }
    return '/' + sourceId
  })
}
