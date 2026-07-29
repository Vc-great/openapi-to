export interface ClassifiedResponseStatusCodes {
  success: string[]
  error: string[]
}

function compareStatus(left: string, right: string): number {
  const rank = (status: string) => {
    if (/^\d{3}$/.test(status)) return Number(status)
    const wildcard = /^([1-5])XX$/.exec(status)
    if (wildcard?.[1]) return Number(wildcard[1]) * 100 + 99
    return Number.POSITIVE_INFINITY
  }
  const leftNumber = rank(left)
  const rightNumber = rank(right)
  return leftNumber - rightNumber || left.localeCompare(right)
}

function canonicalizeStatus(status: string): string {
  if (/^[1-5]xx$/i.test(status)) return status.toUpperCase()
  if (/^default$/i.test(status)) return 'default'
  return status
}

/**
 * Deterministically classify documented responses.
 *
 * Informational 1xx/1XX responses are retained as non-success responses because
 * generated clients do not expose a separate informational-response channel.
 * `default` is a success fallback only when no 2xx response exists.
 */
export function classifyResponseStatusCodes(statusCodes: readonly string[]): ClassifiedResponseStatusCodes {
  const unique = [...new Set(statusCodes.map((status) => canonicalizeStatus(String(status))))]
  const concreteSuccess = unique.filter((code) => /^2\d{2}$/.test(code)).sort(compareStatus)
  const wildcardSuccess = unique.filter((code) => code === '2XX').sort(compareStatus)
  const documentedSuccess = [...concreteSuccess, ...wildcardSuccess]
  const hasDefault = unique.includes('default')
  const success = documentedSuccess.length > 0 ? documentedSuccess : hasDefault ? ['default'] : []
  const error = unique.filter((code) => /^(?:[13-5]\d{2}|[13-5]XX)$/.test(code)).sort(compareStatus)
  if (hasDefault && documentedSuccess.length > 0) error.push('default')
  return { success, error }
}

export function selectSuccessResponseStatusCode(statusCodes: readonly string[]): string | undefined {
  return classifyResponseStatusCodes(statusCodes).success[0]
}
