#!/usr/bin/env node
import('@openapi-to/cli').then(({ run }) => {
  run(process.argv)
})
