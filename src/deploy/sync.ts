import { createCommit } from '@/node/git/createCommit'
import { exec } from '@saus/deploy-utils'
import fs from 'fs'
import path from 'path'
import { GitFiles } from './files'

export async function syncDeployCache(
  cacheDir: string,
  targetBranch: string,
  gitRepo: { name: string; url: string },
  files: GitFiles
) {
  let init: boolean
  if ((init = !fs.existsSync(path.join(cacheDir, '.git')))) {
    await exec('git init', { cwd: cacheDir })
    await exec('git remote add', [gitRepo.name, gitRepo.url], {
      cwd: cacheDir,
    })
  }
  try {
    await exec('git pull --depth 1', [gitRepo.name, targetBranch], {
      cwd: cacheDir,
    })
    if (init) {
      await exec('git branch -u', [gitRepo.name + '/deployed'], {
        cwd: cacheDir,
      })
    }
  } catch (e: any) {
    if (!init || !/Couldn't find remote ref/.test(e.message)) {
      throw e
    }
    files.get('.gitignore').setBuffer('deploy.lock', 'utf8')
    await exec('git add .gitignore', { cwd: cacheDir })
    createCommit('init', { cwd: cacheDir })
    await exec('git push -u', [gitRepo.name, 'master:' + targetBranch], {
      cwd: cacheDir,
    })
  }
}
