import { vite } from '@/vite'
import { resolve } from 'path'
import { vi } from 'vitest'

let configFile: {
  path: string
  config: vite.UserConfig
  dependencies: string[]
}

export const setConfigFile = (root: string, config: vite.UserConfig) =>
  (configFile = {
    path: resolve(root, 'vite.config.js'),
    dependencies: [],
    config: {
      ...config,
      root,
    },
  })

vi.mock('@/vite/configFile', (): typeof import('@/vite/configFile') => {
  return {
    loadConfigFile: async () => configFile,
  }
})

vi.mock('@/vite/configDeps', (): typeof import('@/vite/configDeps') => {
  return {
    loadConfigDeps: async (_command, { plugins }) => ({
      plugins,
    }),
  }
})
