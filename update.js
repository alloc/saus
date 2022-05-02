// @ts-check
const { extractModules } = require('module-extractor')
const shell = require('@cush/shell')
const fs = require('fs')

const astroRoot = 'vendor/astro'
if (fs.existsSync(astroRoot)) {
  shell.sync('git pull', { cwd: astroRoot })
} else {
  shell.sync('git clone', [
    'https://github.com/withastro/astro',
    astroRoot,
    '-b',
    'astro@1.0.0-beta.20',
    '--depth',
    '1',
  ])
}

extractModules({
  debug: true,
  entries: ['runtime/server/index.ts'],
  pkgRoot: astroRoot + '/packages/astro',
  outPkgRoot: './',
  copyFiles: [
    'tsconfig.json',
    'src/@types/serialize-javascript.d.ts',
    'src/@types/shorthash.d.ts',
  ],
  copyDeps: ['typescript'],
})
