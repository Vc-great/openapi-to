import axios from 'axios'
import converter from 'do-swagger2openapi'
import fs from 'fs-extra'
import isUrl from 'is-url'
import { isUndefined, merge } from 'lodash-es'

import { PluginManager } from './pluginManager'

import type { AxiosResponse } from 'axios'
import type { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import type { OpenAPIV3_1 } from 'openapi-types'
import type { Logger } from './logger.ts'
import type { CLIOptions, OpenAPIAllDocument, OpenapiToSingleConfig } from './types'

export async function requestRemoteData(requestUrl: string): Promise<OpenAPIAllDocument | undefined> {
  try {
    const response = await axios.get<null, AxiosResponse<OpenAPIAllDocument>>(requestUrl)

    return response.data
  } catch (error) {
    //todo error
    console.error(error)
    return undefined
  }
}

//读取本地文件
async function readLocalFiles(filePath: string): Promise<OpenAPIAllDocument> {
  return fs.readJsonSync(filePath)
}

//加载数据 本地或者远程
async function loadData(path: string) {
  //判断是本地还是远程url
  const openapiDocument = isUrl(path) ? await requestRemoteData(path) : await readLocalFiles(path)

  if (isUndefined(openapiDocument)) {
    return undefined
  }

  return await swagger2ToOpenapi3(openapiDocument)
}

//
export async function swagger2ToOpenapi3(openapiDocument: OpenAPIAllDocument): Promise<OpenAPIV3.Document | OpenAPIV3_1.Document | undefined> {
  if ('openapi' in openapiDocument) {
    return openapiDocument
  }

  //log  "💺 将 Swagger 转化为 OpenAPI";
  const [err, options] = await converter
    .convertObj(<OpenAPIV2.Document>openapiDocument, {
      warnOnly: true,
    })
    .then(
      (options) => [undefined, options],
      (err) => [err, undefined],
    )

  if (err) {
    throw new Error(`An error occurred with the conversion of swagger to openapi.${err}`)
  }
  return options.openapi
}

export async function build(
  openapiToSingleConfig: OpenapiToSingleConfig,
  CLIOptions: CLIOptions,
  logger: Logger,
): Promise<{ pluginManager: PluginManager; error?: Error }> {
  const openapiDocument = await loadData(openapiToSingleConfig.input.path)

  if (isUndefined(openapiDocument)) {
    throw new Error('Unable to get the OpenAPI Document!')
  }
  //todo logger
  const pluginManager = new PluginManager(openapiToSingleConfig, openapiDocument)

  try {
    await pluginManager.run()
  } catch (e) {
    return {
      pluginManager,
      error: e as Error,
    }
  }

  return {
    pluginManager,
  }
}
