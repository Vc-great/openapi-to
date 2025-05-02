import { componentResponseTemplate } from '@/templates/componentResponseTemplate.ts'
import { createVariable } from '@/templates/operationResponseTemplate.ts'
import { getlowerFirstRefAlias } from '@/utils/getlowerFirstRefAlias.ts'
import type { ComponentsResponsesValue } from '@openapi-to/core'
import { head, values } from 'lodash-es'

export function buildComponentsResponse(response: ComponentsResponsesValue, responseName: string) {
  if (response && '$ref' in response && response.$ref) {
    const typeName = getlowerFirstRefAlias(response.$ref)
    return createVariable(responseName, typeName, [])
  }

  if (response && 'content' in response && response.content) {
    const responseObject = head(values(response.content))
    if (!responseObject) {
      return
    }
    return componentResponseTemplate(responseObject, responseName)
  }
}
