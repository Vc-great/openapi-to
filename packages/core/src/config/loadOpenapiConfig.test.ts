import { access, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { loadOpenapiConfig } from './loadOpenapiConfig.ts'

describe('loadOpenapiConfig', () => {
  it('loads an explicit trusted config and blocks relative imports outside localFileRoot before execution', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openapi-config-root-'))
    const outside = await mkdtemp(path.join(os.tmpdir(), 'openapi-config-outside-'))
    const safeConfig = path.join(root, 'openapi.config.ts')
    await writeFile(safeConfig, 'export default { servers: [], plugins: [] }\n')
    await expect(loadOpenapiConfig({ cwd: root, configPath: safeConfig, localFileRoot: root })).resolves.toMatchObject({ config: { servers: [], plugins: [] } })

    const marker = path.join(outside, 'executed.txt')
    await writeFile(path.join(outside, 'dependency.ts'), `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'executed'); export default {};\n`)
    await writeFile(path.join(root, 'unsafe.config.ts'), `import dependency from ${JSON.stringify(path.join(outside, 'dependency.ts'))}; export default { servers: [], plugins: [dependency] };\n`)
    await expect(loadOpenapiConfig({ cwd: root, configPath: path.join(root, 'unsafe.config.ts'), localFileRoot: root })).rejects.toThrow(/inside the configured local file root/)
    await expect(access(marker)).rejects.toThrow()
  })

  it('rejects a config entry symlink escape', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openapi-config-root-'))
    const outside = await mkdtemp(path.join(os.tmpdir(), 'openapi-config-outside-'))
    const target = path.join(outside, 'openapi.config.js')
    await writeFile(target, 'module.exports = { servers: [], plugins: [] }\n')
    const linked = path.join(root, 'openapi.config.js')
    await symlink(target, linked)
    await expect(loadOpenapiConfig({ cwd: root, configPath: linked, localFileRoot: root })).rejects.toThrow(/inside the configured local file root/)
  })
})
