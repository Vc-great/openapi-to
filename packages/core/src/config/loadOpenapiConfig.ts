import { lstat, open, realpath } from 'node:fs/promises'
import path from 'node:path'

import { bundleRequire } from 'bundle-require'
import { cosmiconfig, type Loader } from 'cosmiconfig'
import type { Plugin } from 'esbuild'

import { folderName } from '../folderName.ts'
import { throwIfAborted } from '../execution.ts'
import type { OpenapiToConfig } from '../types'

export interface LoadOpenapiConfigOptions {
  cwd?: string
  moduleName?: string
  configPath?: string
  /** Restrict the config entry and bundled relative imports to this directory. */
  localFileRoot?: string
  signal?: AbortSignal
}

export interface LoadedOpenapiConfig {
  config: OpenapiToConfig
  filepath: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOutsideRoot(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate)
  return relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)
}

async function createBundledLoader(localFileRoot?: string, signal?: AbortSignal): Promise<Loader> {
  const canonicalRoot = localFileRoot ? await realpath(path.resolve(localFileRoot)) : undefined
  return async (configFile: string) => {
    throwIfAborted(signal)
    const workspaceBoundaryPlugin: Plugin | undefined = canonicalRoot
      ? {
          name: 'openapi-to-config-workspace-boundary',
          setup(build) {
            build.onLoad({ filter: /.*/ }, async (args) => {
              if (args.namespace !== 'file') return
              throwIfAborted(signal)
              const canonicalPath = await realpath(args.path)
              if (isOutsideRoot(canonicalRoot, canonicalPath)) throw new Error('Config local imports must remain inside the configured local file root.')
              const before = await lstat(canonicalPath, { bigint: true })
              const handle = await open(canonicalPath, 'r')
              try {
                const opened = await handle.stat({ bigint: true })
                if (before.dev !== opened.dev || before.ino !== opened.ino) throw new Error('Config source changed while it was being opened.')
                const contents = await handle.readFile('utf8')
                const after = await lstat(canonicalPath, { bigint: true })
                if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size || after.mtimeNs !== opened.mtimeNs) {
                  throw new Error('Config source changed while it was being loaded.')
                }
                throwIfAborted(signal)
                const extension = path.extname(canonicalPath).toLowerCase()
                const loader = extension === '.ts' ? 'ts' : extension === '.tsx' ? 'tsx' : extension === '.jsx' ? 'jsx' : extension === '.json' ? 'json' : 'js'
                return { contents, loader }
              } finally {
                await handle.close()
              }
            })
          },
        }
      : undefined
    const loaded = await bundleRequire({
      filepath: configFile,
      ...(workspaceBoundaryPlugin ? { esbuildOptions: { plugins: [workspaceBoundaryPlugin] } } : {}),
    })
    throwIfAborted(signal)
    return loaded.mod.default ?? loaded.mod
  }
}

export async function loadOpenapiConfig(options: LoadOpenapiConfigOptions = {}): Promise<LoadedOpenapiConfig> {
  throwIfAborted(options.signal)
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const moduleName = options.moduleName ?? 'openapi'
  const loader = await createBundledLoader(options.localFileRoot, options.signal)
  const explorer = cosmiconfig(moduleName, {
    cache: false,
    searchPlaces: ['js', 'cjs', 'ts'].map((extension) => `${folderName}/${moduleName}.config.${extension}`),
    loaders: { '.js': loader, '.cjs': loader, '.ts': loader },
  })
  const result = options.configPath ? await explorer.load(path.resolve(cwd, options.configPath)) : await explorer.search(cwd)
  throwIfAborted(options.signal)
  if (!result || result.isEmpty || !isRecord(result.config)) throw new Error('OpenAPI configuration is not defined or does not export an object.')
  return { config: result.config as OpenapiToConfig, filepath: result.filepath }
}
