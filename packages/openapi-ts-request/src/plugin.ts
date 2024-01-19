import {AST,OpenAPI} from '@openapi-to/core'
import {RequestGenerator} from "./RequestGenerator.ts";
import Oas from 'oas';
export type PluginOptions = {

}

export const definePlugin = createPlugin<PluginOptions>((options) => {
  const ast = new AST()

const openapi = new OpenAPI(oas)
  return {
    //plugin name
    name:"openapi-ts-request",
    //
    resolvePath:(config)=>{
      return config.title
    },
   async buildStart(config,openapiDocument){
      //log
       const oas = new Oas(openapiDocument)
      //start
      const requestGenerate = new RequestGenerator({
        oas:oas,
        ast
      })
      requestGenerate.build()
    },
    writeFile(){
      ast.save()
    },
    buildEnd(){
      //log
    }
  }

})
