import type { Operation } from 'oas/operation'
import _ from 'lodash'

export class Response {
  constructor(private operation: Operation) {
    this.operation = operation
  }

  get isDownLoad() {
    const downLoadKey = ['download', 'export']
    return _.some(downLoadKey, (key) => this.operation.path.includes(key))
  }
}
