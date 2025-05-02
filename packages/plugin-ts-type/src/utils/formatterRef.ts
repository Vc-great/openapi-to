import { getRefAlias } from '@openapi-to/core/utils'
import { lowerFirst, upperFirst } from 'lodash-es'
/*
export function formatterRefFormOperation(ref: string) {
  return `${upperFirst(getRefAlias(ref))}Model`
}

export function formatterRefFormComponentParameter(ref: string) {
  return `Parameters${upperFirst(getRefAlias(ref))}Model`
}
export function formatterRefFormComponentRequestBodies(ref: string) {
  return `RequestBodies${upperFirst(getRefAlias(ref))}Model`
}
export function formatterRefFormComponentResponse(ref: string) {
  return `Responses${upperFirst(getRefAlias(ref))}Model`
}*/

export function getRefFileNameFormComponentRequestBodies(ref: string) {
  return `requestBodies-${lowerFirst(getRefAlias(ref))}.model.ts`
}

export function getRefFileNameFormComponentResponses(ref: string) {
  return `responses-${lowerFirst(getRefAlias(ref))}.model`
}

export function formatterComponentSchemaFileName(ref: string) {
  return `${lowerFirst(getRefAlias(ref))}.model`
}
