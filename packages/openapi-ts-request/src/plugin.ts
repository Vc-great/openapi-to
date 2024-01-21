import {AST,OpenAPI,createPlugin} from '@openapi-to/core'
import {RequestGenerator} from "./RequestGenerator.ts";
import Oas from 'oas';
import type {PluginConfig} from './types.ts'

export const definePlugin = createPlugin<PluginConfig>((pluginConfig)=>({openapiDocument,openapiToSingleConfig}) => {
  const ast = new AST()
  const oas = new Oas({...openapiDocument})
  const openapi = new OpenAPI({}, oas);
  return {
    name:"openapi-ts-request",
   buildStart(){
     const requestGenerator = new RequestGenerator({
       oas,
       ast,
       openapi,
       pluginConfig,
       openapiToSingleConfig,
     });
     requestGenerator.build()
    },
    writeFile(){
      ast.saveSync()
    },
    buildEnd(){
      //log
    }
  }

})
