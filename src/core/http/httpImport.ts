import fs from 'fs'
import os from 'os'
import { join } from 'path'
import { URL } from 'url'
import { unwrapBuffer } from '../buffer'
import { emptyDir } from '../node/emptyDir'
import { get } from './get'

export async function httpImport(url: string) {
  const file = toFilePath(url)
  const resp = await get(url)
  fs.writeFileSync(file, unwrapBuffer(resp.data))
  setExitHandler()
  return import(/* @vite-ignore */ file)
}

const root = /* @__PURE__ */ join(/* @__PURE__ */ os.tmpdir(), 'saus-ssr')

function toFilePath(url: string) {
  const { host, pathname } = new URL(url)
  const path = decodeURIComponent(pathname).replace(/(\.js)?$/, '.js')
  return join(root, host + path)
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
