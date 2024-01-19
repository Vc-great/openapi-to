import _ from "lodash";
export class URLPath {
  path: string;

  constructor(path: string) {
    this.path = path;

    return this;
  }

  get isURL(): boolean {
    try {
      const url = new URL(this.path);
      if (url?.href) {
        return true;
      }
    } catch (error) {
      return false;
    }
    return false;
  }

  /**
   * Convert Swagger path to requestPath(syntax of web)
   * @example /pet/{petId} => `/pet/${petId}`
   * @example /account/monetary-accountID => `/account/${monetaryAccountId}`
   * @example /account/userID => `/account/${userId}`
   */
  get requestPath(): string {
    return this.path.replace(/{([\w-]+)}/g, (matchData, params: string) => {
      return "${" + _.camelCase(params) + "}";
    });
  }

  /**
   * Convert Swagger path to URLPath(syntax of Express)
   * @example /pet/{petId} => /pet/:petId
   */
  get toURLPath(): string {
    return this.path.replaceAll("{", ":").replaceAll("}", "");
  }
}
