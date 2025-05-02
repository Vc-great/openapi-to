export type PluginEnumType = Array<'TsType' | 'Request' | 'SWR' | 'MSW' | 'NestJS' | 'Faker' | 'VueQuery' | 'Zod'>

/**
 * @description 插件枚举值
 */
export enum pluginEnum {
  TsType = 'TsType',
  Request = 'Request',
  SWR = 'SWR',
  MSW = 'MSW',
  NestJS = 'NestJS',
  Faker = 'Faker',
  VueQuery = 'VueQuery',
  Zod = 'Zod',
}

export enum PluginStatus {
  Succeeded = 'succeeded',
  Failed = 'failed',
}
