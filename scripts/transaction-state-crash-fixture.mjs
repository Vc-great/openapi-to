import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  acquireOutputWriteLock,
  commitGenerationStateTransaction,
  compareArtifacts,
  materializeArtifacts,
  snapshotOutputFile,
} from '../packages/core/dist/index.js'

const [workspace, outputRoot, crashPoint] = process.argv.slice(2)
if (!workspace || !outputRoot || !crashPoint) throw new Error('workspace, output root, and crash point are required')

const stateRelativePath = '.OpenAPI/selections/target-0.json'
const statePath = path.join(workspace, ...stateRelativePath.split('/'))
const desiredBytes = new TextEncoder().encode('{"version":"crash-after"}\n')
const artifacts = materializeArtifacts([
  { kind: 'text', path: 'existing.txt', content: 'after crash\n' },
  { kind: 'text', path: 'crash-added.txt', content: 'added crash\n' },
], outputRoot).artifacts
const manifest = await compareArtifacts(artifacts, outputRoot, true)
const recoveryContext = { workspaceRoot: workspace, allowedStateRoots: ['.OpenAPI/selections'] }
const lock = await acquireOutputWriteLock(outputRoot, { recoveryContext })
await commitGenerationStateTransaction(lock, artifacts, manifest, [{
  id: 'selection-0',
  workspaceRelativePath: stateRelativePath,
  expectedBefore: await snapshotOutputFile(statePath),
  desiredBytes,
  desiredSha256: createHash('sha256').update(desiredBytes).digest('hex'),
  maxBytes: 1024,
}], {
  recoveryContext,
  generatorVersion: 'crash-fixture',
  ...(crashPoint === 'committed'
    ? { onPhase(phase) { if (phase === 'committed') process.kill(process.pid, 'SIGKILL') } }
    : { testCrashAt: crashPoint }),
})

await readFile(statePath)
process.exitCode = 2
