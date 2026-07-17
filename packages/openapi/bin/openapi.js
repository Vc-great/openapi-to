#!/usr/bin/env node
import process from 'node:process'
import semver from 'semver'


const requiredVersion =  '>=20.0.0';
if (!semver.satisfies(process.version, requiredVersion)) {
  console.error(`Error: This tool requires Node.js ${requiredVersion}, but you are using ${process.version}`);
  process.exitCode = 1;
} else {
  import('@openapi-to/cli').then(async({run}) => {
    const {updateVersionNotifier} = await import('../dist/utils.js')
    if (!process.argv.includes('--json')) updateVersionNotifier()
    await run(process.argv)
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
