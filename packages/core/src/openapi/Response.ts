import _ from 'lodash'

import type { Operation } from 'oas/operation'

export class Response {
  constructor(private operation: Operation) {
    this.operation = operation
  }

  get isDownLoad() {
    const downLoadKey = ['download', 'export']
    return _.some(downLoadKey, (key) => this.operation.path.includes(key))
  }
}
