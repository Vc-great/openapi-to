const fs = require('fs-extra')
const path = require('path')

const filePath = path.resolve(__dirname, './.OpenAPI/openapi.config.js')

const config = `const {
defineConfig, pluginSWR, pluginTSRequest, pluginTSType, pluginZod
   }= require('openapi-to')

module.exports = defineConfig({
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
