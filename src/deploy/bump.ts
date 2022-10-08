import { prompt } from '@saus/deploy-utils'
import { readFileSync, writeFileSync } from 'fs'
import { fatal } from 'misty'
import path from 'path'
import { onDeploy } from './hooks'

export type VersionBump = 'patch' | 'minor' | 'major'

export interface BumpResult {
  version: string
  /** Equals null on dry run */
  type: VersionBump | null
}

export function bumpAppVersion() {
  return onDeploy<BumpResult>(async (ctx, onRevert) => {
    const pkgPath = path.join(ctx.root, 'package.json')
    const pkgText = readFileSync(pkgPath, 'utf8')
    const { version } = JSON.parse(pkgText)

    if (ctx.dryRun) {
      return { type: null, version }
    }

    const bumps: Record<string, string> = {
      patch: incrementVersion(version, 'patch'),
      minor: incrementVersion(version, 'minor'),
      major: incrementVersion(version, 'major'),
    }

    const { type } = await prompt({
      name: 'type',
      type: 'select',
      message: 'Select a release kind',
      choices: Object.keys(bumps).map(type => ({
        title: type,
        value: type,
        description: 'v' + bumps[type],
      })),
    })

    if (!type) {
      fatal('No release kind was selected')
    }

    const newVersion = bumps[type]
    const newPkgText = pkgText.replace(
      /("version": *)".+?"/,
      (_, key) => key + JSON.stringify(newVersion)
    )

    ctx.rootPackage.version = newVersion
    writeFileSync(pkgPath, newPkgText)
    onRevert(() => {
      writeFileSync(pkgPath, pkgText)
    })

    return { type, version: newVersion }
  })
}

function incrementVersion(version: string, type: VersionBump) {
  const parsedVersion = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (!parsedVersion) {
    throw Error('Project version is not a valid version: ' + version)
  }

  let [major, minor, patch] = parsedVersion.slice(1).map(Number) as number[]

  if (type == 'patch') {
    patch++
  } else if (type == 'minor') {
    minor++
    patch = 0
  } else if (type == 'major') {
    major++
    minor = 0
    patch = 0
  }

  return major + '.' + minor + '.' + patch
}
