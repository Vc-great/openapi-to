// @ts-nocheck
import _ from "lodash";
import { ApiData, GenerateCode } from "./types";
export class GenerateApi implements GenerateCode {
  //private apiItem: ApiData[];

  constructor() {}
  run(tagItem: ApiData[]) {
    return {
      apiCode: this.generatorClass(tagItem),
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
            const { funcParams, requestParams, typesName, paramsSerializer } =
              this.generatorArguments(apiItem);
            types.push(...typesName);
            return `
        ${this.generatorFuncJSDoc(apiItem)}
        ${this.generatorFuncContent({
          apiItem,
          funcParams,
          requestParams,
          paramsSerializer,
        })}`;
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
           *@tag描述 ${description}.
           */`;
  }

  generatorFuncContent({
    apiItem,
    funcParams,
    requestParams,
    paramsSerializer,
  }) {
    //todo 补充 responseType:'blob
    return ` ${
      apiItem.requestName
    }(${funcParams}):Promise<[object,${_.upperFirst(
      apiItem.requestName
    )}Response]>{
      return request.${apiItem.method}({
        url:${this.generatorPath(apiItem)}${
      requestParams ? ",\n" : ""
    }${requestParams}${
      requestParams && paramsSerializer ? ",\n" : ""
    }${paramsSerializer}
      })
    }`;
  }

  //summary中有下载或者导出 关键字 则增加type
  generateResponseType(summary: string) {
    const keys = ["下载", "导出"];
    return _.some(keys, (x) => summary.includes(x))
      ? `responseType:'blob'`
      : "";
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

    const pathRequest = `${_.upperFirst(apiItem.requestName)}PathRequest`;
    const queryRequest = `${_.upperFirst(apiItem.requestName)}QueryRequest`;
    const bodyRequest = `${_.upperFirst(apiItem.requestName)}BodyRequest`;

    const pathStr = path ? `${_.camelCase(path)}:${pathRequest}` : "";

    const queryStr = query ? `query:${queryRequest}` : "";

    const dataStr = body ? `body:${bodyRequest}` : "";

    const typesName = [
      path ? `${pathRequest}` : "",
      query ? `${queryRequest}` : "",
      body ? `${bodyRequest}` : "",
    ].filter((x) => x);

    const funcParams = `${pathStr}${pathStr && queryStr ? "," : ""}${queryStr}${
      (pathStr || queryStr) && dataStr ? "," : ""
    }${dataStr}`;

    const requestParams = `${query ? "params:query" : ""}${
      query && body ? ",\n" : ""
    }${body ? "data:body" : ""}`;

    const hasQueryArray = _.some(
      apiItem.parameters,
      (x) => x.schema.type === "array"
    );
    const paramsSerializer = `paramsSerializer(params) {
                            return qs.stringify(params)
                        }`;

    return {
      funcParams,
      requestParams,
      typesName,
      paramsSerializer,
    };
  }

  //生成path
  generatorPath(apiItem: ApiData) {
    const path = apiItem.path.replace(/{([\w-]+)}/g, (matchData, params) => {
      return "${" + _.camelCase(params) + "}";
    });

    return "`" + path + "`";
  }

  //函数注释
  generatorFuncJSDoc(apiItem: ApiData) {
    return `
    /*
    *@tag名称: ${_.get(apiItem, "tags[0]", "")}
    *@接口名称:${apiItem.summary} 
    */`;
  }

  /* async formatterCode(codeData) {
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
  }*/
}
