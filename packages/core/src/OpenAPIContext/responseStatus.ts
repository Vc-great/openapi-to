export interface ClassifiedResponseStatusCodes {
  success: string[]
  error: string[]
}

function compareStatus(left: string, right: string): number {
  const leftNumber = /^\d{3}$/.test(left) ? Number(left) : Number.POSITIVE_INFINITY
  const rightNumber = /^\d{3}$/.test(right) ? Number(right) : Number.POSITIVE_INFINITY
  return leftNumber - rightNumber || left.localeCompare(right)
}

/** Deterministically classify documented responses; `default` is a success fallback only when no 2xx response exists. */
export function classifyResponseStatusCodes(statusCodes: readonly string[]): ClassifiedResponseStatusCodes {
  const unique = [...new Set(statusCodes.map(String))]
  const concreteSuccess = unique.filter((code) => /^2\d{2}$/.test(code)).sort(compareStatus)
  const wildcardSuccess = unique.filter((code) => /^2xx$/i.test(code)).sort(compareStatus)
  const documentedSuccess = [...concreteSuccess, ...wildcardSuccess]
  const hasDefault = unique.includes('default')
  const success = documentedSuccess.length > 0 ? documentedSuccess : hasDefault ? ['default'] : []
  const error = unique.filter((code) => /^[3-5]\d{2}$/.test(code)).sort(compareStatus)
  if (hasDefault && documentedSuccess.length > 0) error.push('default')
  return { success, error }
}

export function selectSuccessResponseStatusCode(statusCodes: readonly string[]): string | undefined {
  return classifyResponseStatusCodes(statusCodes).success[0]
}
