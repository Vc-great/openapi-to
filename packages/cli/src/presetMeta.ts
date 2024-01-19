export  default `const {
  defineConfig,
  createJSRequest,
  createTSRequest,
  createTSInterface,
  createZod,
  createTanstackQuery,
  createFaker,
  createMSW } require('openapi-to')

module.exports = defineConfig({
  input:[
    {
      title:'swagger',  // output file folder name
      path:'https://petstore.swagger.io/v2/swagger.json'  //api documentation url
    }
  ],
  plugins: [
    createJSRequest({
      createZodDecorator: true
    }),
    createTSRequest({
      createZodDecorator: true
    }),
    createTSInterface(),
    createZod(),
    createTSRequest(),
    createTanstackQuery(),
    createFaker(),
    createMSW()
  ]
})`
