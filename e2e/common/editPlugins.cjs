const fs = require("fs-extra");
const path = require("path");

const filePath = path.resolve(__dirname, "./.OpenAPI/openapi.config.js");

const config =`const {
  defineConfig,
  createTSRequest,
  createTSType,
  createZod,
  createFaker,
  createMSW,
  createNestjs
   }= require('openapi-to')

module.exports = defineConfig({
  servers:[
    {
    input: {
      name:'swagger',  // output file folder name
      path:'https://petstore.swagger.io/v2/swagger.json'  //api documentation url
    }
    }
  ],
  plugins:[
    createTSRequest({
      createZodDecorator: true,
            compare: true,
            zodDecoratorImportDeclaration: {
        moduleSpecifier: "./test/zod",
      },
      requestImportDeclaration: {
        moduleSpecifier: "./test/request",
      },
    }),
    createTSType({
     compare: true
    }),
    createZod(),
    createFaker({
      compare: true
    }),
    createMSW(),
    createNestjs()
  ]
})`


fs.writeFileSync(filePath,config);


