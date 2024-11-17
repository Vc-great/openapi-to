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
    createTSRequest({
      createZodDecorator: false,
      requestType:'axios'
    }),
    createTSType()
  ]
}`;

export const commonPresetMeta = `const {
  defineConfig,
  createTSRequest,
  createTSType
   }= require('openapi-to')

module.exports = defineConfig(${config})`;

export const modulePresetMeta = `import {
  defineConfig,
  createTSRequest,
  createTSType
   } from'openapi-to'

export default  defineConfig(${config})`;
