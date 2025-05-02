import { componentResponseTemplate } from '@/templates/componentResponseTemplate.ts'
import { createTypeAlias } from '@/templates/operationResponseTemplate.ts'
import { getUpperFirstRefAlias } from '@/utils/getUpperFirstRefAlias.ts'
import type { ComponentsResponsesValue } from '@openapi-to/core'
import { head, values } from 'lodash-es'

export function buildComponentsResponse(response: ComponentsResponsesValue, responseName: string) {
  if (response && '$ref' in response && response.$ref) {
    const typeName = getUpperFirstRefAlias(response.$ref)
    return createTypeAlias(responseName, typeName, [])
  }

  if (response && 'content' in response && response.content) {
    const responseObject = head(values(response.content))
    if (!responseObject) {
      return
    }
    return componentResponseTemplate(responseObject, responseName)
  }
}
