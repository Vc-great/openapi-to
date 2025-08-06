const fs = require('fs-extra')
const path = require('path')

const filePath = path.resolve(__dirname, './.OpenAPI/openapi.config.ts')

const config = `import { defineConfig, pluginSWR, pluginTSRequest, pluginTSType, pluginZod,pluginVueQuery } from 'openapi-to'


export default defineConfig({
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
  plugins: [
    pluginSWR(),
    pluginVueQuery(),
    pluginZod(),
    pluginTSType(),
    pluginTSRequest({
      parser: 'zod',
      requestClient: 'common',
      requestImportDeclaration: {
        moduleSpecifier: '../../request',
      },
      requestConfigTypeImportDeclaration: {
        namedImports: ['AxiosRequestConfig'],
        moduleSpecifier: 'axios',
      }
          })
  ]
})`

fs.writeFileSync(filePath, config, { encoding: 'utf8' })
