const { gray, red, green } = require('kleur/colors')
const { startTask } = require('misty/task')
const path = require('path')
const rollup = require('rollup')
const dts = require('rollup-plugin-dts').default
const ts = require('typescript')

const outFile = 'bundle/index.d.ts'

async function run() {
  const bundle = await rollup.rollup({
    input: 'src/bundle/main.ts',
    external: id => !/^[./]/.test(id),
    plugins: [
      dts({
        // compilerOptions: ts.parseJsonConfigFileContent(
        //   ts.readConfigFile(
        //     path.resolve('src/client/tsconfig.json'),
        //     ts.sys.readFile
        //   ).config,
        //   ts.sys,
        //   path.resolve('src/client')
        // ).options,
        compilerOptions: {
          lib: ['lib.dom.d.ts', 'lib.es2019.d.ts'],
          module: ts.ModuleKind.ESNext,
          types: [path.resolve('env/client')],
        },
      }),
      reporter,
    ],
  })

  await bundle.write({
    file: outFile,
    format: 'es',
  })
}

const task = startTask(`bundling types...`)
const reporter = {
  async load(id) {
    console.log(gray(`load`), path.relative(process.cwd(), id))
  },
}

run()
  .then(
    () => task.finish(`saved types to ${green(outFile)}`),
    e => console.error(red(e.message))
  )
  .then(() => task.finish())
