import exec from '@cush/exec'
import fs from 'fs'
import path from 'path'
import { crawl } from 'recrawl-sync'
import { emptyDir, esbuild, esbuildViteBridge, toObjectHash } from 'saus/core'
import {
  createDryLog,
  defineDeployHook,
  DeployContext,
  getDeployContext,
} from 'saus/deploy'
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

    debugger
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
    if (context.dryRun) {
      return createDryLog('@saus/vercel')(
        `would deploy ${target.entries.length} serverless functions`
      )
    }
    await pushFunctions(target, context)
    // TODO: return rollback function
  },
  update(target) {
    return this.spawn(target)
  },
  async kill(target) {
    const deployDir = getDeployDir(target)
    const { gitRepo } = context

    if (context.dryRun) {
      createDryLog('@saus/vercel')(
        `would destroy ${target.entries.length} serverless functions`
      )
    } else {
      await exec('git push --delete', [gitRepo.name, target.gitBranch], {
        cwd: deployDir,
      })
    }

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
  const version = context.rootPackage.version || '0.0.0'
  return 'v' + version + '-' + context.lastCommitHash
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
    plugins: [await esbuildViteBridge(context)],
    sourcemap: 'external',
    splitting: true,
    target: 'esnext',
    treeShaking: true,
    write: false,
  })

  return outputFiles
}

function bindExec(...boundArgs: exec.Args): typeof exec.async
function bindExec(cmd: string, ...boundArgs: exec.Args): typeof exec.async
function bindExec(...boundArgs: any[]) {
  const boundCmd = typeof boundArgs[0] == 'string' ? boundArgs.shift() : ''
  return (cmd: string, ...args: exec.Args) =>
    exec((boundCmd ? boundCmd + ' ' : '') + cmd, ...args, ...boundArgs)
}
