const config = `{
servers:[
  {
    input: {
      path:'https://petstore.swagger.io/v2/swagger.json'  //api documentation url
    },
    output:{
       dir:'server'
    }
  }
],
  plugins:[
    pluginSWR(),
    pluginZod(),
    pluginTSType(),
    pluginTSRequest({
      requestImportDeclaration: {
        moduleSpecifier: '@/utils/request',
      },
      requestConfigTypeImportDeclaration: {
        namedImports: ['AxiosRequestConfig'],
        moduleSpecifier: 'axios',
      },
    })
  ]
}`

export const commonPresetMeta = `const {
defineConfig, 
pluginSWR,
pluginTSRequest,
pluginTSType, 
pluginZod 
   }= require('openapi-to')

module.exports = defineConfig(${config})`

export const modulePresetMeta = `import {
defineConfig,
pluginSWR, 
pluginTSRequest,
pluginTSType, 
pluginZod 
   } from'openapi-to'

export default  defineConfig(${config})`
