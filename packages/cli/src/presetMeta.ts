export const commonPresetMeta= `const {
  defineConfig,
  createTSRequest,
   }= require('openapi-to')

module.exports = defineConfig({
  input:[
    {
      name:'swagger',  // output file folder name
      path:'https://petstore.swagger.io/v2/swagger.json'  //api documentation url
    }
  ],
  plugins: [
    createTSRequest({
      createZodDecorator: true
    })
  ]
})`


export const modulePresetMeta= `import {
  defineConfig,
  createTSRequest,
   } from'openapi-to'

export default defineConfig({
  input:[
    {
      name:'swagger',  // output file folder name
      path:'https://petstore.swagger.io/v2/swagger.json'  //api documentation url
    }
  ],
  plugins: [
    createTSRequest({
      createZodDecorator: true
    })
  ]
})`
