import { lookup as lookupWithCallback } from 'node:dns'
import { lookup } from 'node:dns/promises'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { Agent as HttpAgent } from 'node:http'
import { Agent as HttpsAgent } from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import axios from 'axios'
import converter from 'do-swagger2openapi'
import { load as loadYaml } from 'js-yaml'

import { errorCause, sortDiagnostics, type Diagnostic } from '../diagnostics.ts'
import type { CompatibleOpenAPIDocument, OpenAPIAllDocument, RemoteSourceOptions } from '../types'

export type OpenAPIInput = string | URL | Record<string, unknown>

export interface SourceLoaderOptions {
  cwd?: string
  /** Restrict every local source, including transitive file references, to this real directory. */
  localFileRoot?: string
  remote?: RemoteSourceOptions
  cache?: Map<string, Promise<LoadedSource>>
  debug?: boolean
}

function isOutsideRoot(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate)
  return relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)
}

async function resolveRestrictedLocalPath(filePath: string, localFileRoot: string, debug = false): Promise<{ path?: string; diagnostics: Diagnostic[] }> {
  const lexicalRoot = path.resolve(localFileRoot)
  const lexicalPath = path.resolve(filePath)
  let root: string
  try {
    root = await realpath(lexicalRoot)
    const rootStat = await lstat(lexicalRoot)
    if (!rootStat.isDirectory()) throw new Error('The local file root is not a directory.')
  } catch (error) {
    return { diagnostics: [sourceDiagnostic('LOCAL_SOURCE_ROOT_INVALID', 'The configured local file root is unavailable.', lexicalRoot, error, debug)] }
  }
  const lexicallyInside = !isOutsideRoot(lexicalRoot, lexicalPath) || !isOutsideRoot(root, lexicalPath)
  if (!lexicallyInside) {
    return { diagnostics: [sourceDiagnostic('LOCAL_SOURCE_OUTSIDE_ROOT', 'Local OpenAPI sources must remain inside the configured local file root.', lexicalPath)] }
  }
  try {
    await lstat(lexicalPath)
    const canonicalPath = await realpath(lexicalPath)
    if (isOutsideRoot(root, canonicalPath)) {
      return { diagnostics: [sourceDiagnostic('LOCAL_SOURCE_SYMLINK_ESCAPE', 'Local OpenAPI sources may not escape the configured local file root through a symlink.', lexicalPath)] }
    }
    return { path: canonicalPath, diagnostics: [] }
  } catch (error) {
    return { diagnostics: [sourceDiagnostic('INPUT_READ_FAILED', 'Unable to read OpenAPI source.', lexicalPath, error, debug)] }
  }
}

export interface LoadedSource {
  source: string
  uri: string
  contentType?: string
  text?: string
  value?: Record<string, unknown>
  diagnostics: Diagnostic[]
}

export interface LoadedOpenAPIDocument {
  source: string
  uri: string
  document?: CompatibleOpenAPIDocument
  originalDocument?: OpenAPIAllDocument
  version?: string
  diagnostics: Diagnostic[]
}

const defaultRemoteOptions: Required<Omit<RemoteSourceOptions, 'allowedHosts' | 'headers'>> = {
  allowPrivateNetwork: false,
  timeoutMs: 10_000,
  maxResponseBytes: 10 * 1024 * 1024,
  maxRedirects: 5,
}

function sanitizedRemoteSource(url: URL): string {
  const copy = new URL(url)
  copy.username = ''
  copy.password = ''
  copy.search = ''
  return copy.toString()
}

function hostMatches(hostname: string, pattern: string): boolean {
  const normalizedHostname = hostname.toLowerCase()
  const normalizedPattern = pattern.toLowerCase()
  if (normalizedPattern.startsWith('*.')) {
    const suffix = normalizedPattern.slice(1)
    return normalizedHostname.endsWith(suffix) && normalizedHostname.length > suffix.length
  }
  return normalizedHostname === normalizedPattern
}

function isPrivateIPv4(address: string): boolean {
  const octets = address.split('.').map(Number)
  const [a = 0, b = 0] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

export function isPrivateIPAddress(address: string): boolean {
  if (isIP(address) === 4) return isPrivateIPv4(address)
  if (isIP(address) !== 6) return false
  const normalized = address.toLowerCase()
  if (normalized.startsWith('::ffff:')) return isPrivateIPv4(normalized.slice(7))
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || /^fe[89ab]/.test(normalized)
}

export async function validateRemoteURL(url: URL, options: RemoteSourceOptions = {}): Promise<Diagnostic[]> {
  const source = sanitizedRemoteSource(url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return [{ code: 'REMOTE_SOURCE_BLOCKED', severity: 'error', message: `Remote protocol ${url.protocol} is not allowed.`, location: { source } }]
  }

  if (options.allowedHosts?.length && !options.allowedHosts.some((host) => hostMatches(url.hostname, host))) {
    return [{ code: 'REMOTE_SOURCE_BLOCKED', severity: 'error', message: `Remote host ${url.hostname} is not in allowedHosts.`, location: { source } }]
  }

  if (options.allowPrivateNetwork) return []
  if (url.hostname.toLowerCase() === 'localhost' || url.hostname.endsWith('.localhost')) {
    return [{ code: 'REMOTE_SOURCE_BLOCKED', severity: 'error', message: 'Localhost access is blocked by the remote source policy.', location: { source } }]
  }

  try {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true })
    if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIPAddress(address))) {
      return [{
        code: 'REMOTE_SOURCE_BLOCKED',
        severity: 'error',
        message: `Remote host ${url.hostname} resolves to a private, local, or reserved address.`,
        location: { source },
        hint: 'Set input.remote.allowPrivateNetwork only for trusted internal specifications; consider allowedHosts as an additional restriction.',
      }]
    }
  } catch (error) {
    return [{ code: 'REMOTE_SOURCE_FAILED', severity: 'error', message: `Unable to resolve remote host ${url.hostname}.`, location: { source }, cause: errorCause(error) }]
  }
  return []
}

function sourceDiagnostic(code: string, message: string, source: string, error?: unknown, debug = false): Diagnostic {
  return { code, severity: 'error', message, location: { source }, cause: errorCause(error, debug) }
}

function sanitizedRemoteCause(error: unknown, url: URL, debug = false): string | undefined {
  const cause = errorCause(error, debug)
  if (!cause) return undefined
  return cause.replaceAll(url.toString(), sanitizedRemoteSource(url)).replaceAll(`${url.origin}${url.pathname}${url.search}`, `${url.origin}${url.pathname}`)
}

function restrictedLookup(): LookupFunction {
  return (hostname, _options, callback) => {
    lookupWithCallback(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) {
        callback(error, '', 0)
        return
      }
      const address = addresses.find((candidate) => !isPrivateIPAddress(candidate.address))
      if (!address || addresses.some((candidate) => isPrivateIPAddress(candidate.address))) {
        const blocked = new Error(`Connection to ${hostname} was blocked because DNS resolved to a private, local, or reserved address.`) as NodeJS.ErrnoException
        blocked.code = 'EACCES'
        callback(blocked, '', 0)
        return
      }
      callback(null, address.address, address.family)
    })
  }
}

async function fetchRemoteSource(initialURL: URL, options: RemoteSourceOptions, debug = false): Promise<LoadedSource> {
  const policy = { ...defaultRemoteOptions, ...options }
  const lookupAtConnection = policy.allowPrivateNetwork ? undefined : restrictedLookup()
  const httpAgent = lookupAtConnection ? new HttpAgent({ lookup: lookupAtConnection }) : undefined
  const httpsAgent = lookupAtConnection ? new HttpsAgent({ lookup: lookupAtConnection }) : undefined
  let currentURL = initialURL
  for (let redirect = 0; redirect <= policy.maxRedirects; redirect += 1) {
    const diagnostics = await validateRemoteURL(currentURL, policy)
    if (diagnostics.length > 0) return { source: sanitizedRemoteSource(currentURL), uri: currentURL.toString(), diagnostics }
    const source = sanitizedRemoteSource(currentURL)
    try {
      const response = await axios.get<string>(currentURL.toString(), {
        headers: options.headers,
        httpAgent,
        httpsAgent,
        maxBodyLength: policy.maxResponseBytes,
        maxContentLength: policy.maxResponseBytes,
        maxRedirects: 0,
        responseType: 'text',
        timeout: policy.timeoutMs,
        transformResponse: [(value) => value],
        validateStatus: () => true,
      })
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        if (redirect === policy.maxRedirects) {
          return { source, uri: currentURL.toString(), diagnostics: [sourceDiagnostic('REMOTE_SOURCE_REDIRECT_LIMIT', 'Remote source exceeded the redirect limit.', source)] }
        }
        currentURL = new URL(response.headers.location, currentURL)
        continue
      }
      if (response.status < 200 || response.status >= 300) {
        return { source, uri: currentURL.toString(), diagnostics: [sourceDiagnostic('REMOTE_SOURCE_FAILED', `Remote source returned HTTP ${response.status}.`, source)] }
      }
      const text = typeof response.data === 'string' ? response.data : String(response.data)
      if (Buffer.byteLength(text) > policy.maxResponseBytes) {
        return { source, uri: currentURL.toString(), diagnostics: [sourceDiagnostic('REMOTE_SOURCE_TOO_LARGE', `Remote source exceeds the ${policy.maxResponseBytes} byte limit.`, source)] }
      }
      return { source, uri: currentURL.toString(), contentType: response.headers['content-type'], text, diagnostics: [] }
    } catch (error) {
      const axiosCode = axios.isAxiosError(error) ? error.code : undefined
      const code = axiosCode === 'ECONNABORTED' || axiosCode === 'ETIMEDOUT' ? 'REMOTE_SOURCE_TIMEOUT' : axiosCode === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED' || axiosCode === 'ERR_BAD_RESPONSE' ? 'REMOTE_SOURCE_TOO_LARGE' : 'REMOTE_SOURCE_FAILED'
      const diagnostic = sourceDiagnostic(code, code === 'REMOTE_SOURCE_TIMEOUT' ? 'Remote source request timed out.' : 'Unable to load remote source.', source)
      diagnostic.cause = sanitizedRemoteCause(error, currentURL, debug)
      return { source, uri: currentURL.toString(), diagnostics: [diagnostic] }
    }
  }
  return { source: sanitizedRemoteSource(initialURL), uri: initialURL.toString(), diagnostics: [] }
}

export async function loadSource(input: OpenAPIInput, options: SourceLoaderOptions = {}): Promise<LoadedSource> {
  if (typeof input === 'object' && !(input instanceof URL)) {
    return { source: '<object>', uri: 'memory://openapi', value: input, diagnostics: [] }
  }
  const raw = input instanceof URL ? input.toString() : input
  let parsedURL: URL | undefined
  try {
    parsedURL = new URL(raw)
  } catch {
    parsedURL = undefined
  }
  if (parsedURL && parsedURL.protocol !== 'file:') {
    const key = parsedURL.toString()
    const cache = options.cache ?? new Map<string, Promise<LoadedSource>>()
    const cached = cache.get(key)
    if (cached) return cached
    const pending = fetchRemoteSource(parsedURL, options.remote ?? {}, options.debug)
    cache.set(key, pending)
    return pending
  }

  let filePath = parsedURL?.protocol === 'file:' ? fileURLToPath(parsedURL) : path.resolve(options.cwd ?? process.cwd(), raw)
  if (options.localFileRoot) {
    const restricted = await resolveRestrictedLocalPath(filePath, options.localFileRoot, options.debug)
    if (!restricted.path) return { source: filePath, uri: pathToFileURL(filePath).toString(), diagnostics: restricted.diagnostics }
    filePath = restricted.path
  }
  const uri = pathToFileURL(filePath).toString()
  try {
    return { source: filePath, uri, text: await readFile(filePath, 'utf8'), diagnostics: [] }
  } catch (error) {
    return { source: filePath, uri, diagnostics: [sourceDiagnostic('INPUT_READ_FAILED', 'Unable to read OpenAPI source.', filePath, error, options.debug)] }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseOpenAPISource(source: LoadedSource, debug = false): { value?: Record<string, unknown>; diagnostics: Diagnostic[] } {
  if (source.value) return { value: source.value, diagnostics: [] }
  if (source.text === undefined) return { diagnostics: source.diagnostics }
  const text = source.text
  const likelyJSON = source.contentType?.toLowerCase().includes('json') || path.extname(new URL(source.uri).pathname).toLowerCase() === '.json' || /^[\s\uFEFF]*(?:\[|\{)/.test(text)
  const parsers: Array<() => unknown> = likelyJSON ? [() => JSON.parse(text), () => loadYaml(text)] : [() => loadYaml(text), () => JSON.parse(text)]
  let lastError: unknown
  for (const parse of parsers) {
    try {
      const value = parse()
      if (isRecord(value)) return { value, diagnostics: [] }
      lastError = new Error('The document root must be an object.')
    } catch (error) {
      lastError = error
    }
  }
  const mark = (lastError as { mark?: { line?: number; column?: number } } | undefined)?.mark
  const diagnostic = sourceDiagnostic('OPENAPI_PARSE_FAILED', 'Unable to parse OpenAPI document as JSON or YAML.', source.source, lastError, debug)
  if (mark?.line !== undefined) diagnostic.location = { ...diagnostic.location, line: mark.line + 1, column: (mark.column ?? 0) + 1 }
  return { diagnostics: [diagnostic] }
}

async function convertSwaggerDocument(document: Record<string, unknown>, source: string, debug = false): Promise<{ document?: CompatibleOpenAPIDocument; diagnostics: Diagnostic[] }> {
  if (typeof document.openapi === 'string') return { document: document as CompatibleOpenAPIDocument, diagnostics: [] }
  if (document.swagger !== '2.0') return { diagnostics: [] }
  try {
    const converted = await converter.convertObj(document as never, { warnOnly: true })
    return {
      document: converted.openapi as CompatibleOpenAPIDocument,
      diagnostics: [{ code: 'OPENAPI_SWAGGER_CONVERTED', severity: 'info', message: 'Swagger 2.0 input was converted to an OpenAPI 3 compatibility document for validation and generation.', location: { source } }],
    }
  } catch (error) {
    return { diagnostics: [sourceDiagnostic('OPENAPI_VALIDATION_FAILED', 'Unable to convert Swagger 2.0 document to OpenAPI 3.', source, error, debug)] }
  }
}

export async function loadOpenAPIDocument(input: OpenAPIInput, options: SourceLoaderOptions = {}): Promise<LoadedOpenAPIDocument> {
  const source = await loadSource(input, options)
  if (source.diagnostics.length > 0) return { source: source.source, uri: source.uri, diagnostics: sortDiagnostics(source.diagnostics) }
  const parsed = parseOpenAPISource(source, options.debug)
  if (!parsed.value) return { source: source.source, uri: source.uri, diagnostics: sortDiagnostics(parsed.diagnostics) }
  const originalDocument = parsed.value as OpenAPIAllDocument
  const converted = await convertSwaggerDocument(parsed.value, source.source, options.debug)
  const document = converted.document ?? (parsed.value as CompatibleOpenAPIDocument)
  const version = typeof parsed.value.openapi === 'string' ? parsed.value.openapi : typeof parsed.value.swagger === 'string' ? parsed.value.swagger : undefined
  return { source: source.source, uri: source.uri, originalDocument, document, version, diagnostics: sortDiagnostics(converted.diagnostics) }
}
