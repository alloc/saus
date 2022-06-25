import { prompt } from '@saus/deploy-utils'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { createDryLog, onDeploy } from 'saus/deploy'

export type BumpType = 'patch' | 'minor' | 'major'

export interface BumpResult {
  type: string
  version: string
}

export function bumpProjectVersion() {
  return onDeploy<BumpResult>(async (ctx, onRevert) => {
    const { type } = await prompt({
      name: 'type',
      type: 'select',
      choices: [
        { title: 'Patch', value: 'patch' },
        { title: 'Minor', value: 'minor' },
        { title: 'Major', value: 'major' },
      ],
    })

    const pkgPath = path.join(ctx.root, 'package.json')
    const pkgText = readFileSync(pkgPath, 'utf8')
    const { version } = JSON.parse(pkgText)

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

    const newVersion = major + '.' + minor + '.' + patch
    const newPkgText = pkgText.replace(
      /("version": *)".+?"/,
      (_, key) => key + JSON.stringify(newVersion)
    )

    ctx.rootPackage.version = newVersion
    if (ctx.dryRun) {
      createDryLog('@saus/bump')(`would bump the project to v${newVersion}`)
    } else {
      writeFileSync(pkgPath, newPkgText)
      onRevert(() => {
        writeFileSync(pkgPath, pkgText)
      })
    }

    return { type, version: newVersion }
  })
}
