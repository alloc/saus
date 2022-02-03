import fs from 'fs'
import os from 'os'
import { join } from 'path'
import { URL } from 'url'
import { get } from '../../core/http'
import { emptyDir } from '../../utils/emptyDir'

export async function httpImport(url: string) {
  const file = toFilePath(url)
  fs.writeFileSync(file, await get(url))
  setExitHandler()
  return import(file)
}

const root = join(os.tmpdir(), 'saus-ssr')

function toFilePath(url: string) {
  const { host, pathname } = new URL(url)
  return join(root, host + decodeURIComponent(pathname))
}

function onExit() {
  emptyDir(root)
}

function setExitHandler() {
  if (process.listeners('exit').includes(onExit)) {
    return
  }
  const signals = ['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGQUIT']
  for (const name of [...signals, 'exit', 'uncaughtException']) {
    process.on(name, onExit)
  }
}