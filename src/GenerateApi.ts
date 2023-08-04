// @ts-nocheck
import _ from "lodash";
import { ApiData, GenerateCode } from "./types";
import { OpenAPIV3, RequestBodyObject } from "openapi-types";

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
            const args = this.generatorArguments(apiItem);
            types.push(...args.typesName);
            return `
        ${this.generatorFuncJSDoc(apiItem)}
        ${this.generatorFuncContent({
          apiItem,
          ...args,
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
    formData,
    formDataHeader,
  }) {
    //todo 补充 responseType:'blob
    const contents = [
      `url:${this.generatorPath(apiItem)}`,
      requestParams,
      paramsSerializer,
      formDataHeader,
    ];
    const filterContents = (contents) => _.filter(contents, (x) => x);
    const addContents = (contents) =>
      _.reduce(
        contents,
        (result, value) => {
          result += (result ? ",\n" : "") + value;
          return result;
        },
        ""
      );

    return ` ${
      apiItem.requestName
    }(${funcParams}):Promise<[object,${_.upperFirst(
      apiItem.requestName
    )}Response]>{${formData ? "\n" + formData + "\n" : ""}
      return request.${apiItem.method}({
        ${_.flow([filterContents, addContents])(contents)}
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
    const paramsSerializer = hasQueryArray
      ? `paramsSerializer(params) {
                            return qs.stringify(params)
                        }`
      : "";
    const { formDataHeader, formData } = this.generateFormData(apiItem);

    //todo application/x-www-form-urlencoded 类型参数

    return {
      funcParams,
      requestParams,
      typesName,
      paramsSerializer,
      formDataHeader,
      formData,
    };
  }

  generateFormData(apiItem: ApiData) {
    const formDataHeader = `headers: { 'Content-Type': 'multipart/form-data' }`;
    const formData = `//todo 上传文件
    const formData = new FormData();
    formData.append("file", file);`;

    if ("$ref" in apiItem.requestBody) {
      const component: OpenAPIV3.RequestBodyObject = this.getComponentByRef(
        apiItem.requestBody.$ref
      );
      if (component.content && "multipart/form-data" in component.content) {
        return {
          formDataHeader,
          formData,
        };
      }
    }

    if (
      "content" in apiItem.requestBody &&
      "multipart/form-data" in apiItem.requestBody.content
    ) {
      return {
        formDataHeader,
        formData,
      };
    }

    return {
      formDataHeader: "",
      formData: "",
    };
  }

  getComponentByRef(ref) {
    return _.get(
      this.openApi3SourceData,
      ref.split("/").slice(1).join("."),
      undefined
    );
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
