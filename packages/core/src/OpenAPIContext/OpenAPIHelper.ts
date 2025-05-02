import { map as _map, camelCase, keys } from 'lodash-es'
import type Oas from 'oas'
import type { HttpMethods } from 'oas/types'
import { pinyin } from 'pinyin-pro'
import { removePunctuation } from '../utils/removePunctuation.ts'
import { OperationAccessor } from './OperationAccessor.ts'
import type { OperationsByTag } from './types.ts'

export class OpenAPIHelper {
  public oas: Oas

  constructor(oasInstance: Oas) {
    this.oas = oasInstance

    // this.generateOperationName()
  }

  /*  generateOperationName() {
    // 构建 operation name 映射
    const allOps = this.getAllOperations()
    const names = inferOperationNamesByTags(allOps)
    allOps.forEach(({ path, method, accessor }) => {
      const key = `${path}-${method}`
      const opName = names[key] || fallbackOperationName(path, method)
      accessor.setOperationName(opName)
    })
  }*/

  //将所有的operation按照tag进行分组
  get operationsByTag(): OperationsByTag {
    const operations = this.getAllOperations()
    const grouped: OperationsByTag = {}

    for (const { path, method, accessor } of operations) {
      const tags = _map(accessor.operation.getTags(), 'name') || ['default']
      for (const tag of tags) {
        if (!grouped[tag]) {
          grouped[tag] = []
        }
        grouped[tag].push({
          path,
          method,
          tagName: camelCase(tag),
          accessor,
        })
      }
    }

    return grouped
  }

  formatterName(name: string): string {
    return this.containsChinese(name)
      ? pinyin(removePunctuation(name), {
          toneType: 'none',
          type: 'array',
        }).join('_')
      : camelCase(name)
  }

  containsChinese(str: string) {
    // 匹配中文字符 Unicode 范围：\u4e00 至 \u9fff
    return /[\u4e00-\u9fff]/.test(str)
  }
  /**
   * 获取某路径某方法的 operation 信息封装
   */
  getOperation(path: string, method: HttpMethods): OperationAccessor | null {
    const operation = this.oas.operation(path, method)
    return operation ? OperationAccessor.getInstance(operation) : null
  }

  /**
   * 获取所有 paths 的封装信息
   */
  getAllOperations(): { path: string; method: HttpMethods; accessor: OperationAccessor }[] {
    const result: any[] = []
    const paths = keys(this.oas.getPaths())
    const pathObjects = this.oas.api.paths!
    for (const path of paths) {
      for (const method of keys(pathObjects[path]) as HttpMethods[]) {
        const accessor = this.getOperation(path, method)
        if (accessor) {
          result.push({ path, method, accessor })
        }
      }
    }
    return result
  }
}
