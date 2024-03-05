[![codecov](https://codecov.io/github/Vc-great/openapi-to/branch/V2/graph/badge.svg?token=5UB04YYCEB)](https://codecov.io/github/Vc-great/openapi-to)

## openapi-to
Generate SDKs,OpenAPI to:
+ [ ] js request(jsDoc)
+ [x] ts request
+ [x] ts type
+ [ ] request object
+ [x] zod
+ [x] zod decorator
+ [ ] vue-Query
+ [ ] Faker.js

OpenAPI Specifications are supported:
- swagger 2.0
- openapi 3.0


## Install
```
npm i openapi-to -g
```


## Usage
```js
  openapi init  // Generate openapi.config.js file
  openapi g     // Generate code from the openapi.config.js file
```

## openapi.config
```ts
import {
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
    createZod()
  ]
})
```




