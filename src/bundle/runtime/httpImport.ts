import fs from 'fs'
import os from 'os'
import { join } from 'path'
import { URL } from 'url'
import { get } from '../../core/http'
import { emptyDir } from '../../utils/emptyDir'

export async function httpImport(url: string) {
  const code: any = await get(url)
  const ext = url.slice(url.lastIndexOf('.') + 1)
  if (ext == 'json') {
    return JSON.parse(code)
  }
  if (ext == 'js') {
    const file = toFilePath(url)
    fs.writeFileSync(file, code)
    setExitHandler()
    return import(file)
  }
  throw TypeError(`Unknown file extension "${ext}"`)
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
