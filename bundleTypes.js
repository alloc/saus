const { gray, red, green } = require('kleur/colors')
const { startTask } = require('misty/task')
const path = require('path')
const rollup = require('rollup')
const dts = require('rollup-plugin-dts').default

const outFile = 'bundle/index.d.ts'

async function run() {
  const bundle = await rollup.rollup({
    input: 'src/bundle/main.ts',
    external: id => !/^[./]/.test(id),
    plugins: [dts(), reporter],
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
