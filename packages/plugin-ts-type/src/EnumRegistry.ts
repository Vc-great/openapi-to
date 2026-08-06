import { find, upperFirst } from 'lodash-es'
import { formatSourcePath, type InlineEnumSourcePath } from '@/utils/inlineEnumNaming.ts'

export interface EnumItem {
  name: string
  enumValue: unknown[]
  description?: string
  extend?: string
  sourcePath?: InlineEnumSourcePath
}

export class EnumRegistry {
  private enums: Map<string, EnumItem[]> = new Map()
  private symbols: Map<string, { declarationKey: string; sourcePath: InlineEnumSourcePath }> = new Map()

  add(name: string, schemaENum: unknown[], description?: string, sourcePath: InlineEnumSourcePath = [name]) {
    const existing = this.enums.get(JSON.stringify(schemaENum))
    const enumName = this.addSuffix(name)
    const finalSymbol = `${upperFirst(enumName)}Value`
    const declarationKey = JSON.stringify([schemaENum, description])
    const existingSymbol = this.symbols.get(finalSymbol)
    if (existingSymbol) {
      if (
        JSON.stringify(existingSymbol.sourcePath) === JSON.stringify(sourcePath) &&
        existingSymbol.declarationKey === declarationKey
      ) {
        return
      }
      throw new Error(
        `Inline enum symbol collision for ${finalSymbol}: ${formatSourcePath(existingSymbol.sourcePath)} and ${formatSourcePath(sourcePath)}.`,
      )
    }
    this.symbols.set(finalSymbol, { declarationKey, sourcePath })
    if (existing && existing[0]?.name === enumName) {
      return
    }

    //
    if (existing) {
      this.enums.set(JSON.stringify(schemaENum), [...existing, { name: enumName, enumValue: schemaENum, description: description, extend: existing[0]?.name }])
      return
    }
    this.enums.set(JSON.stringify(schemaENum), [{ name: enumName, enumValue: schemaENum, description: description, extend: undefined }])
  }

  adds(enums: EnumItem[]) {
    enums.forEach((item) => {
      this.add(item.name, item.enumValue, item.description, item.sourcePath)
    })
  }

  //给name增加后缀
  addSuffix(name: string) {
    return `${name}Enum`
  }

  getAll(): EnumItem[] {
    return Array.from(this.enums.values()).flat()
  }

  getName(schemaEnum: unknown[]): string {
    const enumItem = this.enums.get(JSON.stringify(schemaEnum))
    //enumItem 不存在 报错
    if (!enumItem) {
      throw new Error(`Enum not found for schema: ${JSON.stringify(schemaEnum)}`)
    }
    return upperFirst(enumItem[0]?.name)
  }

  getEnumValueName(schemaEnum: unknown[], name: string): string {
    const enums = this.enums.get(JSON.stringify(schemaEnum))
    const enumItem = find(enums, ['name', this.addSuffix(name)])
    //enumItem 不存在 报错
    if (!enumItem) {
      throw new Error(`Enum symbol not found: ${upperFirst(this.addSuffix(name))}Value`)
    }
    return `${upperFirst(enumItem.name)}Value`
  }

  formatterName(name: string) {
    return `${upperFirst(name)}EnumValue`
  }

  has(enumJSON: string): boolean {
    return this.enums.has(enumJSON)
  }

  clear() {
    this.enums.clear()
    this.symbols.clear()
  }
}
