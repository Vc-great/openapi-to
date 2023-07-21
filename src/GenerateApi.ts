import type {
  ContentObject,
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  ResponsesObject,
  SchemaObject,
} from "openapi3-ts";
import _ from "lodash";
import fs from "fs";
import path from "path";
import { ApiData, GenerateCode } from "./types";
import dayjs from "dayjs";
export class GenerateApi implements GenerateCode {
  private apiItem: ApiData[];

  constructor() {}
  run(tagItem: ApiData[]) {
    return {
      apiData: this.generatorClass(tagItem),
    };
  }

  generatorClass(tagItem: ApiData[]) {
    const types: string[] = [];
    const str = `
                    import request from '@/api/request'
                    ${this.generatorClassJSDoc(tagItem)}
                    class ApiName {
                        ${tagItem
                          .map((apiItem) => {
                            const [funcParams, requestParams, typesName] =
                              this.generatorArguments(apiItem);
                            types.push(...typesName);
                            return `
                        ${this.generatorFuncJSDoc(apiItem)}
                        ${apiItem.requestName}(${funcParams}):Promise<[object,${
                              apiItem.requestName
                            }Response]>{
                            return request.${apiItem.method}({
                                url:${this.generatorPath(apiItem)}${
                              requestParams ? ",\n" : ""
                            }
                                ${requestParams}
                            })
                        }`;
                          })
                          .join("")}
                        }
                        const apiName = new ApiName
                        
                        export { apiName }
                    `;
    const typeStr = `
          \n//TODO: 修正引用
        import type {${types.join()}} from './types'`;

    return typeStr + str;
  }

  generatorClassJSDoc(tagItem: ApiData[]) {
    const name = _.get(_.head(tagItem), "tags[0]", "");
    const description = _.get(_.head(tagItem), "description", "");
    return `/*
           *@tag名称 ${name}.
           *tag描述 ${description}.
           */`;
  }

  //函数参数
  generatorArguments(apiItem: ApiData) {
    //params路径参数
    const path = _.chain(apiItem.parameters)
      .filter(["in", "path"])
      .map("name")
      .join(",")
      .value();

    //query 查询参数
    const query = _.some(apiItem.parameters, ["in", "query"]);

    //data body参数
    const body = _.get(apiItem, "requestBody.$ref", "") ? "data" : "";
    //todo 替换type名称
    const pathStr = path ? `${path}:${apiItem.requestName}PathRequest` : "";

    const queryStr = query ? `query:${apiItem.requestName}QueryRequest` : "";

    const dataStr = body ? `body:${apiItem.requestName}DataRequest` : "";

    const typesName = [
      path ? `${apiItem.requestName}PathRequest` : "",
      query ? `${apiItem.requestName}QueryRequest` : "",
      body ? `${apiItem.requestName}DataRequest` : "",
    ].filter((x) => x);

    const funcParams = `${pathStr}${queryStr}${dataStr}`;

    const requestParams = `${query ? "params:query" : ""}
                                  ${query && body ? ",\n" : ""}
                                  ${body ? "data:body" : ""}`;
    return [funcParams, requestParams, typesName];
  }

  //生成path
  generatorPath(item) {
    const path = item.path.replace(/{([\w-]+)}/g, (matchData, params) => {
      return "${" + params + "}";
    });

    return "`" + path + "`";
  }

  //函数注释
  generatorFuncJSDoc(apiItem: ApiData) {
    return `
    /*
    *tag名称: ${_.get(apiItem, "tags[0]", "")}
    *描述信息: ${apiItem.summary}
    */`;
  }

  handleDescribe(item, option, menusItemName) {
    const url = `${option.yapiUrl}/project/${item.project_id}/interface/api/${item._id}`;

    return `*@接口分类  ${menusItemName}
    *@接口名称  ${item.title}
    *@接口地址  ${url}
    *@创建人  ${item.username}
    *@创建时间 ${dayjs.unix(item.add_time).format("YYYY-MM-DD HH:mm:ss")}
    *@更新时间  ${dayjs.unix(item.up_time).format("YYYY-MM-DD HH:mm:ss")}`;
  }

  // data参数
  handleData(item) {
    //
    const addRequired = (required, name) =>
      `${required ? "[" : ""}data.${name}${required ? "]" : ""}`;
    if (!item?.req_body_other) {
      return [];
    }

    const req_body_other = JSON.parse(item?.req_body_other);

    const properties = req_body_other?.items?.properties;

    const result = _.reduce(
      properties,
      (result, value, key) => {
        //  const type = req_body_other?.item?.type

        const str = `*@param {${value.type}} ${addRequired(
          value.required,
          key
        )}  ${value.description}`;
        return result.concat(str);
      },
      []
    );
    return result;
  }

  //

  titleCase(str) {
    return str.toLowerCase().replace(/( |^)[a-z]/g, (L) => L.toUpperCase());
  }

  checkIsJSON(str) {
    if (typeof str == "string") {
      try {
        var obj = JSON.parse(str);
        if (typeof obj == "object" && obj) {
          return true;
        } else {
          return false;
        }
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  async formatterCode(codeData) {
    const OPTION = {
      text: "",
      eslintConfig: {
        parserOptions: {
          ecmaVersion: 7,
        },
        rules: {
          semi: ["error", "never"],
        },
      },
      prettierOptions: {
        bracketSpacing: true,
        tabWidth: 4,
        parser: "babel", //解析器，默认是babylon，与babel相同。
      },
      fallbackPrettierOptions: {
        singleQuote: false,
      },
    };
    const formatMap = _.map(codeData, async (item, index) => {
      const option = _.cloneDeep(OPTION);
      option.text = item.code;
      return {
        ...item,
        code: await format(option),
      };
    });

    return await Promise.all(formatMap).catch((err) => {
      console.log("格式化错误", err);
      console.log("-> 跳过格式化");
      return codeData;
    });
  }

  writeFile(codaData, title) {
    _.map(codaData, (item) => {
      const filePath = path.join(
        this.option.projectDir,
        `.yapi/ts/${title}`,
        `${item.fileName}.ts`
      );
      fs.outputFileSync(filePath, item.code);
      const typesFilePath = path.join(
        this.option.projectDir,
        `.yapi/ts/${title}`,
        `${item.fileName}Types.ts`
      );
      fs.outputFileSync(typesFilePath, item.types);
      const jsonSchemaFilePath = path.join(
        this.option.projectDir,
        `.yapi/jsonSchema/${title}`,
        `${item.fileName}.js`
      );

      let jsonSchema =
        "const jsonSchema = " + JSON.stringify(item.jsonSchema, null, 4) + "\n";
      fs.outputFileSync(jsonSchemaFilePath, jsonSchema);
      success(`${item.fileName}`);
    });
  }

  replaceStr(str) {
    return str.replace(/-/g, "_");
  }
}
