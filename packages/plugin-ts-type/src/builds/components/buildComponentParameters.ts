import { jsDocTemplateFromSchema } from '@/templates/jsDocTemplateFromSchema.ts'
import { createTypeAlias } from '@/templates/operationResponseTemplate.ts'
import { schemaTemplate } from '@/templates/schemaTemplate.ts'
import { getUpperFirstRefAlias } from '@/utils/getUpperFirstRefAlias.ts'

import type { ComponentsParameterValue } from '@openapi-to/core'
import { upperFirst } from 'lodash-es'

export function buildComponentParameters(parameter: ComponentsParameterValue, parameterName: string) {
  const parameterTypeName = `Parameter${upperFirst(parameterName)}Model`

  if (parameter && '$ref' in parameter && parameter.$ref) {
    const typeName = getUpperFirstRefAlias(parameter.$ref)
    return createTypeAlias(parameterTypeName, typeName, [])
  }

  if (parameter && 'schema' in parameter && parameter.schema && '$ref' in parameter.schema && parameter.schema.$ref) {
    const typeName = getUpperFirstRefAlias(parameter.schema.$ref)
    return createTypeAlias(parameterTypeName, typeName, [])
  }

  if (parameter && 'schema' in parameter && parameter.schema && !('$ref' in parameter.schema)) {
    const typeString = schemaTemplate(parameter.schema, parameterTypeName)

    return createTypeAlias(parameterTypeName, typeString, jsDocTemplateFromSchema(parameter.description || '', parameter.schema, parameterName))
  }
  return undefined
}
