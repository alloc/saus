import fs from 'fs'

// Assume the working directory is the `build.outDir` option.
export async function loadModule(id: string) {
  return fs.readFileSync(id, 'utf8')
}

// Assume the working directory is the `build.outDir` option.
export async function loadAsset(id: string): Promise<Buffer> {
  return fs.readFileSync(id)
}
