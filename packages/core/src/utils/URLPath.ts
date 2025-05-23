import { camelCase } from 'lodash-es'
export class URLPath {
  path: string

  constructor(path: string) {
    this.path = path

    return this
  }

  get isURL(): boolean {
    try {
      const url = new URL(this.path)
      if (url?.href) {
        return true
      }
    } catch (error) {
      return false
    }
    return false
  }

  /**
   * Convert Swagger path to requestPath(syntax of web)
   * @example /pet/{petID} => `/pet/${petID}`
   * @example /account/monetary-accountID => `/account/${monetaryAccountId}`
   * @example /account/userID => `/account/${userId}`
   */
  get requestPath(): string {
    const str = this.path.replace(/{([\w-]+)}/g, (matchData, params: string) => {
      return `\${${camelCase(params)}}`
    })
    return str.includes('$') ? `\`${str}\`` : `'${str}'`
  }

  /**
   * Convert Swagger path to URLPath(syntax of Express)
   * @example /pet/{pet-id} => /pet/:petId
   */
  get toURLPath(): string {
    return this.path.replace(/{([\w-]+)}/g, (matchData, params: string) => {
      return `:${camelCase(params)}`
    })
    // return this.path.replaceAll("{", ":").replaceAll("}", "");
  }
}
