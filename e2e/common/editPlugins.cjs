const fs = require("fs-extra");
const path = require("path");

const filePath = path.resolve(__dirname, "./.OpenAPI/openapi.config.js");

const config =`const {
  defineConfig,
  createTSRequest,
  createTSType
   }= require('openapi-to')

module.exports = defineConfig({
  input:[
    {
      name:'swagger',  // output file folder name
      path:'https://petstore.swagger.io/v2/swagger.json'  //api documentation url
    }
  ],
  plugins:[
    createTSRequest({
      createZodDecorator: true
    }),
    createTSType()
  ]
})`


fs.writeFileSync(filePath,config);


