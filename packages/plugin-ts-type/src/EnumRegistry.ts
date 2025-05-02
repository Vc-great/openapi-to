import { find, head, isEmpty, upperFirst } from 'lodash-es'

export interface EnumItem {
  name: string
  enumValue: any[]
  description?: string
  extend?: string
}

export class EnumRegistry {
  private enums: Map<string, EnumItem[]> = new Map()

  add(name: string, schemaENum: any[], description?: string) {
    const existing = this.enums.get(JSON.stringify(schemaENum))
    const enumName = this.addSuffix(name)
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
      this.add(item.name, item.enumValue, item.description)
    })
  }

  //给name增加后缀
  addSuffix(name: string) {
    return `${name}Enum`
  }

  getAll(): EnumItem[] {
    return Array.from(this.enums.values()).flat()
  }

  getName(schemaEnum: any[]): string {
    const enumItem = this.enums.get(JSON.stringify(schemaEnum))
    //enumItem 不存在 报错
    if (!enumItem) {
      throw new Error(`Enum not found for schema: ${JSON.stringify(schemaEnum)}`)
    }
    return upperFirst(enumItem[0]?.name)
  }

  getEnumValueName(schemaEnum: any[], name: string): string {
    const enums = this.enums.get(JSON.stringify(schemaEnum))
    const enumItem = find(enums, ['name', this.addSuffix(name)]) || head(enums)
    //enumItem 不存在 报错
    if (!enumItem) {
      throw new Error(`Enum not found for schema: ${JSON.stringify(schemaEnum)}`)
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
  }
}

export const enumRegistry = new EnumRegistry()
