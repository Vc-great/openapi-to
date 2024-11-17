import {generate} from "./generate.ts";
import type {CLIOptions, OpenapiToSingleConfig} from "@openapi-to/core";

describe('generate', () => {
  const openapiToSingleConfig1:OpenapiToSingleConfig = {
    name:'server1',
    input:{
      path:'https://petstore.swagger.io/v2/swagger.json'
    },
    output:{
      dir:''
    },
    plugins:[
      function plugin1(){
          return {
            name:"plugin1",
            async buildStart(context){
               new Promise((resolve,reject)=>{
                    setTimeout(()=>{
                      resolve()
                    },2000)
               })
            },
            writeFile(){
              return []
            },
            buildEnd(){},
          }
      },
      function plugin2(){
        return {
          name:"plugin2",
          async buildStart(context){
            new Promise((resolve,reject)=>{
              setTimeout(()=>{
                resolve()
              },1000)
            })
          },
          writeFile(){
            return []
          },
          buildEnd(){},
        }
      }
    ]
  }

  const openapiToSingleConfig2:OpenapiToSingleConfig = {
    name:'server2',
    input:{
      path:'https://petstore.swagger.io/v2/swagger.json'
    },
    output:{
      dir:''
    },
    plugins:[
      function plugin1(){
        return {
          name:"plugin1",
          async buildStart(context){
            new Promise((resolve,reject)=>{
              setTimeout(()=>{
                resolve()
              },2000)
            })
          },
          writeFile(){
            return []
          },
          buildEnd(){},
        }
      },
      function plugin2(){
        return {
          name:"plugin2",
          async buildStart(context){
            new Promise((resolve,reject)=>{
              setTimeout(()=>{
                resolve()
              },1000)
            })
          },
          writeFile(){
            return []
          },
          buildEnd(){},
        }
      }
    ]
  }
  const CLIOptions:CLIOptions = {
    logLevel:'debug'
  }
  test('generate', async () => {
    const map = [openapiToSingleConfig1,openapiToSingleConfig2].map(openapiToSingleConfig=>generate(openapiToSingleConfig,CLIOptions))
    await Promise.all(map)

  },1000*10)
})
