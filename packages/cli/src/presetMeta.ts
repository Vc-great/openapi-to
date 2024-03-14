export const commonPresetMeta = `const {
  defineConfig,
  createTSRequest,
  createTSType
   }= require('openapi-to')

module.exports = defineConfig({
servers:[
  {
    input: {
      name:'swagger',  // output file folder name
      path:'https://petstore.swagger.io/v2/swagger.json'  //api documentation url
    }
  ],
  }
],
  plugins:[
    createTSRequest({
      createZodDecorator: true
    }),
    createTSType()
  ]
})`;

export const modulePresetMeta = `import {
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
})`;
