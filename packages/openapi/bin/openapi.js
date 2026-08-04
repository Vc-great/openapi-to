#!/usr/bin/env node
import process from 'node:process'
import semver from 'semver'


const requiredVersion =  '>=20.0.0';
const globalBooleanOptions = new Set([
  '--debug',
  '--json',
  '--no-debug',
  '--no-json',
])

function topLevelCommand(argv) {
  for (const argument of argv.slice(2)) {
    if (argument === '--') return undefined
    const optionName = argument.split('=', 1)[0]
    if (globalBooleanOptions.has(optionName)) continue
    return argument
  }
  return undefined
}

if (!semver.satisfies(process.version, requiredVersion)) {
  console.error(`Error: This tool requires Node.js ${requiredVersion}, but you are using ${process.version}`);
  process.exitCode = 1;
} else {
  import('@openapi-to/cli').then(async({run}) => {
    const {updateVersionNotifier} = await import('../dist/utils.js')
    const isSkillsCommand = topLevelCommand(process.argv) === 'skills'
    if (!isSkillsCommand && !process.argv.includes('--json')) updateVersionNotifier()
    await run(process.argv)
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
