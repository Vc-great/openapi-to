#!/usr/bin/env node
import process from 'node:process'
import semver from 'semver'


const requiredVersion =  '>=20.0.0';
if (!semver.satisfies(process.version, requiredVersion)) {
  console.error(`Error: This tool requires Node.js ${requiredVersion}, but you are using ${process.version}`);
  process.exit(1);
}

import('@openapi-to/cli').then(async({run}) => {
  const {updateVersionNotifier} = await import('../dist/utils.js')
  updateVersionNotifier()
  run(process.argv)
})
