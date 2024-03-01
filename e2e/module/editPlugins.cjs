const fs = require("fs-extra");
const path = require("path");

const filePath = path.resolve(__dirname, "./.OpenAPI/openapi.config.ts");

const config =`import {
  defineConfig,
  createTSRequest,
  createTSType,
  createZod,
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
    }),
    createTSType(),
    createZod(),
  ]
})`


fs.writeFileSync(filePath,config);


