#!/usr/bin/env node
import process from 'node:process'
import { updateVersionNotifier } from '../dist/utils.js'

import('@openapi-to/cli').then(({ run }) => {
  const currentNodeVersion = process.version.slice(1).split('.')[0]

  if (currentNodeVersion < 16) {
    const str = `ERROR: This version requires at least Node.js v16.0
The current version of Node.js is ${process.version}
`
    console.log(str)
    return
  }

  updateVersionNotifier()
  run(process.argv)
})
