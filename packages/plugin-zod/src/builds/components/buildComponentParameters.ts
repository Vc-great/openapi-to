import { jsDocTemplateFromSchema } from '@/templates/jsDocTemplateFromSchema.ts'
import { createVariable } from '@/templates/operationResponseTemplate.ts'
import { schemaTemplate } from '@/templates/schemaTemplate.ts'
import { getlowerFirstRefAlias } from '@/utils/getlowerFirstRefAlias.ts'

import type { ComponentsParameterValue } from '@openapi-to/core'
import { upperFirst } from 'lodash-es'

export function buildComponentParameters(parameter: ComponentsParameterValue, parameterName: string) {
  const parameterTypeName = `Parameter${upperFirst(parameterName)}Model`

  if (parameter && '$ref' in parameter && parameter.$ref) {
    const typeName = getlowerFirstRefAlias(parameter.$ref)
    return createVariable(parameterTypeName, typeName, [])
  }

  if (parameter && 'schema' in parameter && parameter.schema && '$ref' in parameter.schema && parameter.schema.$ref) {
    const typeName = getlowerFirstRefAlias(parameter.schema.$ref)
    return createVariable(parameterTypeName, typeName, [])
  }

  if (parameter && 'schema' in parameter && parameter.schema && !('$ref' in parameter.schema)) {
    const typeString = schemaTemplate(parameter.schema, parameterTypeName)

    return createVariable(parameterTypeName, typeString, jsDocTemplateFromSchema(parameter.description || '', parameter.schema, parameterName))
  }
  return undefined
}
