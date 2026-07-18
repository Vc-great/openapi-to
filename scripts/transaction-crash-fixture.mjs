import path from 'node:path'

import {
  acquireOutputWriteLock,
  commitOutputTransaction,
  compareArtifacts,
  hashArtifactContent,
} from '../packages/core/dist/index.js'

const outputRoot = path.resolve(process.argv[2])
const content = new TextEncoder().encode('after crash\n')
const added = new TextEncoder().encode('new file\n')
const artifacts = [
  { kind: 'text', path: path.join(outputRoot, 'existing.txt'), relativePath: 'existing.txt', content, hash: hashArtifactContent(content) },
  { kind: 'text', path: path.join(outputRoot, 'new.txt'), relativePath: 'new.txt', content: added, hash: hashArtifactContent(added) },
]
const manifest = await compareArtifacts(artifacts, outputRoot, true)
const lock = await acquireOutputWriteLock(outputRoot)
await commitOutputTransaction(lock, artifacts, manifest, { generatorVersion: 'crash-fixture', testCrashAt: 'rename-first' })
process.exitCode = 99
