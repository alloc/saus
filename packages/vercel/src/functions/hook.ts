import exec from '@cush/exec'
import builtinModules from 'builtin-modules'
import fs from 'fs'
import path from 'path'
import { crawl } from 'recrawl-sync'
import {
  defineDeployHook,
  DeployContext,
  emptyDir,
  esbuild,
  getDeployContext,
  getViteTransform,
  SourceMap,
  toDevPath,
  toInlineSourceMap,
  toObjectHash,
} from 'saus/core'
import { Props } from './types'

interface Target extends Props {
  entries: string[]
}

export default defineDeployHook(context => ({
  name: 'vercel/functions',
  async pull(props: Props) {
    const { gitRepo, root } = context
    const deployDir = getDeployDir(props)
    const git = bindExec('git', { cwd: deployDir })

    await prepareDeployDir(deployDir, props, context, git)
    await git('reset --hard', [gitRepo.name + '/' + props.gitBranch])
    emptyDir(deployDir, ['.git'])

    const entries = crawl(path.resolve(root, props.functionDir), {
      only: props.entries || ['*.ts'],
      skip: ['_*', 'node_modules', '.git'],
      absolute: true,
    }).map(entry => path.relative(root, entry))

    const files = await bundleFunctions(entries, props, context)
    const modules: Record<string, string> = {}
    for (const file of files) {
      fs.mkdirSync(path.dirname(file.path), { recursive: true })
      fs.writeFileSync(file.path, file.contents)
      if (!file.path.endsWith('.map')) {
        const fileName = path.relative(deployDir, file.path)
        modules[fileName] = file.text
      }
    }
    return {
      buildHash: toObjectHash(modules, 16),
      /** Resolved entries, relative to the `functionDir` option. */
      entries,
    }
  },
  identify: target => ({
    branch: target.gitBranch,
  }),
  async spawn(target) {
    if (context.dryRun) return
    await pushFunctions(target, context)
    // TODO: return rollback function
  },
  update(target) {
    return this.spawn(target)
  },
  async kill(target) {
    const deployDir = getDeployDir(target)
    const { gitRepo } = context

    if (!context.dryRun)
      await exec('git push --delete', [gitRepo.name, target.gitBranch], {
        cwd: deployDir,
      })

    try {
      emptyDir(deployDir)
      fs.unlinkSync(deployDir)
    } catch {}
  },
}))

async function prepareDeployDir(
  deployDir: string,
  props: Props,
  { gitRepo }: DeployContext,
  git: exec.Exec
) {
  if (fs.existsSync(deployDir)) {
    return
  }
  try {
    fs.mkdirSync(path.dirname(deployDir), { recursive: true })
    await exec(
      'git clone',
      [gitRepo.url, props.gitBranch, '-o', gitRepo.name, '-b', props.gitBranch],
      { cwd: path.dirname(deployDir) }
    )
  } catch (e: any) {
    if (!/Remote branch .+? not found in upstream/.test(e)) {
      throw e
    }
    fs.mkdirSync(deployDir)
    await git('init')
    await git('remote add', [gitRepo.name, gitRepo.url])
    await git('checkout -b', [props.gitBranch])
  }
}

async function pushFunctions(
  target: Target,
  context: DeployContext,
  git = bindExec('git', { cwd: getDeployDir(target) })
) {
  await git('add -A')
  await git('commit -m', [await getDeployCommitMessage(context)])

  const { gitRepo } = context
  const localBranch = await git('rev-parse --abbrev-ref head')
  await git('push -u', [gitRepo.name, localBranch + ':' + target.gitBranch])
}

async function getDeployCommitMessage(context: DeployContext) {
  const pkgVersion: string =
    JSON.parse(fs.readFileSync(path.join(context.root, 'package.json'), 'utf8'))
      .version || '0.0.0'

  const lastCommitHash = await exec('git rev-parse --short head', {
    cwd: context.root,
  })

  return 'v' + pkgVersion + '-' + lastCommitHash
}

function getDeployDir(props: Props) {
  const context = getDeployContext()
  return path.join(context.root, 'node_modules/.vercel', props.gitBranch)
}

async function bundleFunctions(
  entries: string[],
  props: Props,
  context: DeployContext
) {
  const config = await context.resolveConfig('build', {
    plugins: context.bundlePlugins,
  })

  const { transform, pluginContainer } = await getViteTransform({
    ...config,
    plugins: config.plugins.filter(p => p.name !== 'commonjs'),
  })
  await pluginContainer.buildStart({})

  const moduleOverrideByPath: Record<string, string> = {}
  const moduleOverrides: Record<string, string> = {
    debug: 'export default () => () => {}',
  }

  const esbuildVite: esbuild.Plugin = {
    name: 'vite-bridge',
    setup(build) {
      build.onResolve({ filter: /.+/ }, async ({ path: id, importer }) => {
        if (!importer) {
          return { path: id }
        }
        if (builtinModules.includes(id)) {
          return { path: id, external: true, sideEffects: false }
        }
        const resolved = await pluginContainer.resolveId(id, importer, {
          ssr: true,
        })
        if (resolved) {
          if (moduleOverrides[id]) {
            moduleOverrideByPath[resolved.id] = moduleOverrides[id]
          }
          return {
            path: resolved.id,
            sideEffects: !!resolved.moduleSideEffects,
          }
        }
      })
      build.onLoad({ filter: /.+/ }, async ({ path: id }) => {
        if (moduleOverrideByPath[id]) {
          return {
            contents: moduleOverrideByPath[id],
            loader: 'js',
          }
        }
        const transformed = await transform(toDevPath(id, context.root, true))
        if (transformed) {
          let { code, map } = transformed as { code: string; map?: SourceMap }
          if (map) {
            map.sources = map.sources.map(source => {
              return source ? path.relative(path.dirname(id), source) : null!
            })
            code += map ? toInlineSourceMap(map) : ''
          }
          return {
            contents: code,
            loader: 'js',
          }
        }
      })
    },
  }

  const outBase = path.join(context.root, props.functionDir)
  const outDir = path.join(getDeployDir(props), 'api')

  const { outputFiles } = await esbuild.build({
    absWorkingDir: context.root,
    bundle: true,
    chunkNames: '_chunk.[hash]',
    entryNames: '[dir]/[name]',
    entryPoints: entries.map(entry => path.join(outBase, entry)),
    format: 'esm',
    logLevel: 'error',
    metafile: true,
    minify: props.minify,
    outbase: outBase,
    outdir: outDir,
    plugins: [esbuildVite],
    sourcemap: 'external',
    splitting: true,
    target: 'esnext',
    treeShaking: true,
    write: false,
  })

  await pluginContainer.close()
  return outputFiles
}

function bindExec(...boundArgs: exec.Args): typeof exec.async
function bindExec(cmd: string, ...boundArgs: exec.Args): typeof exec.async
function bindExec(...boundArgs: any[]) {
  const boundCmd = typeof boundArgs[0] == 'string' ? boundArgs.shift() : ''
  return (cmd: string, ...args: exec.Args) =>
    exec((boundCmd ? boundCmd + ' ' : '') + cmd, ...args, ...boundArgs)
}
