import { bindExec, exec } from '@saus/deploy-utils'
import fs from 'fs'
import path from 'path'
import { crawl } from 'recrawl-sync'
import {
  emptyDir,
  esbuild,
  esbuildViteBridge,
  plural,
  toObjectHash,
} from 'saus/core'
import { defineDeployHook, DeployContext, getDeployContext } from 'saus/deploy'
import { Props } from './types'

interface Target extends Props {
  entries: string[]
}

export default defineDeployHook(ctx => ({
  name: 'vercel/functions',
  async pull(props: Props) {
    const { gitRepo, root } = ctx
    const deployDir = getDeployDir(props)
    const git = bindExec('git', { cwd: deployDir })

    await prepareDeployDir(deployDir, props, ctx, git)
    emptyDir(deployDir, ['.git'])

    const entries = crawl(path.resolve(root, props.functionDir), {
      only: props.entries || ['*.ts'],
      skip: ['_*', 'node_modules', '.git'],
      absolute: true,
    }).map(entry => path.relative(root, entry))

    const files = await bundleFunctions(entries, props, ctx)
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
    gitBranch: target.gitBranch,
  }),
  // TODO: return rollback function
  spawn(target) {
    return ctx.logPlan(
      `deploy ${plural(target.entries.length, 'serverless function')}`,
      () => pushFunctions(target, ctx)
    )
  },
  update(target, _, onRevert) {
    return this.spawn(target, onRevert)
  },
  async kill(target) {
    const deployDir = getDeployDir(target)
    const { gitRepo } = ctx

    await ctx.logPlan(
      `destroy ${plural(target.entries.length, 'serverless function')}`,
      () =>
        exec('git push --delete', [gitRepo.name, target.gitBranch], {
          cwd: deployDir,
        })
    )

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
    await git('reset --hard', [gitRepo.name + '/' + props.gitBranch])
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
  await git('commit -m', [await getDeployCommitMessage(context)], {
    noThrow: /nothing to commit/,
  })

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
    entryPoints: entries.map(entry => path.join(context.root, entry)),
    format: 'esm',
    logLevel: 'error',
    metafile: true,
    minify: props.minify,
    outbase: outBase,
    outdir: outDir,
    plugins: [await esbuildViteBridge(context)],
    sourcemap: 'external',
    splitting: true,
    target: 'es2020',
    treeShaking: true,
    write: false,
  })

  return outputFiles
}
