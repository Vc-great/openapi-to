import _ from "lodash";
import type {
  ApiData,
  Config,
  GenerateCode,
  OpenApi3FormatData,
} from "./types";
import { OpenAPIV3 } from "openapi-types";
import path from "path";
import fse from "fs-extra";
import { numberEnum, prettierFile, stringEnum } from "./utils";
import { errorLog, successLog } from "./log";
import { GenerateApi } from "./GenerateApi";

export class GenerateTSApi extends GenerateApi implements GenerateCode {
  private readonly namespaceName: string;
  constructor(
    public config: Config,
    openApi3SourceData: OpenAPIV3.Document,
    public openApi3FormatData: OpenApi3FormatData
  ) {
    super(openApi3SourceData);
    this.config = config;
    this.openApi3FormatData = openApi3FormatData;
    this.namespaceName = "ApiType";
  }

  get queryRequest() {
    return `${this.namespaceName}.${_.upperFirst(
      this.apiItem.requestName
    )}QueryRequest`;
  }

  get pathParams() {
    const formatterBaseType = (
      schemaObject:
        | OpenAPIV3.ReferenceObject
        | OpenAPIV3.SchemaObject
        | undefined
    ) => {
      if (!schemaObject) {
        return "";
      }
      if ("$ref" in schemaObject) {
        //todo
        errorLog("pathParams");
        return "";
      }

      let type = schemaObject.type || "";
      if (
        numberEnum.includes(type) ||
        numberEnum.includes(schemaObject.format || "")
      ) {
        return "number";
      }
      if (stringEnum.includes(type)) {
        return "string";
      }
      return type;
    };

    return _.chain(this.apiItem.parameters || [])
      .filter(["in", "path"])
      .map((parameter) => {
        if ("$ref" in parameter) return "";
        return `${parameter.name}:${formatterBaseType(parameter.schema)}`;
      })
      .join()
      .value();
  }
  get bodyRequest() {
    return `${this.namespaceName}.${_.upperFirst(
      this.apiItem.requestName
    )}BodyRequest`;
  }

  run(tagItem: ApiData[]) {
    return {
      title: _.get(_.head(tagItem), "tags[0]", ""),
      codeString: prettierFile(this.generatorClass(tagItem)),
    };
  }

  generatorClass(tagItem: ApiData[]) {
    const str = `
    import request from '@/api/request'
    ${this.generatorClassJSDoc(tagItem)}
    class ApiName {
        ${tagItem
          .map((apiItem) => {
            super.setApiItem(apiItem);
            return `
        ${this.generatorFuncJSDoc(apiItem)}
        ${this.generatorFuncContent(apiItem)}`;
          })
          .join("")}
        }
        const apiName = new ApiName
        
        export { apiName }
    `;
    const typeStr = `
          \n//TODO: edit import
        import type { ApiType } from './types'`;

    return typeStr + str;
  }

  generatorClassJSDoc(tagItem: ApiData[]) {
    const name = _.get(_.head(tagItem), "tags[0]", "");
    const description = _.get(_.head(tagItem), "description", "");
    return `/**
           *@tagName ${name}.
           *@tagDescription ${description}.
           */`;
  }

  generatorFuncContent(apiItem: ApiData) {
    const { formDataHeader, uploadFormData } = super.generateUploadFormData(
      apiItem
    );

    //函数参数
    const funcParams = [
      super.hasPathParameters ? this.pathParams : "",
      super.hasQueryParameters ? `query:${this.queryRequest}` : "",
      super.hasRequestBodyParams ? `body:${this.bodyRequest}` : "",
    ]
      .filter((x) => x)
      .join();

    //todo 补充 responseType:'blob
    const contents = [
      `url:${super.generatorPath(apiItem)}`,
      super.hasQueryParameters ? "params:query" : "",
      super.hasRequestBodyParams ? "data:body" : "",
      super.getParamsSerializer(this.queryRequest),
      // this.downLoadResponseType(),
      formDataHeader,
    ];
    return ` ${apiItem.requestName}(${funcParams}):Promise<[object,${
      this.namespaceName
    }.${_.upperFirst(apiItem.requestName)}Response]>{${
      uploadFormData ? "\n" + uploadFormData + "\n" : ""
    }
      return request.${apiItem.method}({
        ${_.chain(contents)
          .filter((x) => !!x)
          .reduce((result, value) => {
            result += (result ? ",\n" : "") + value;
            return result;
          }, "")
          .value()}
      })
    }`;
  }

  //函数注释
  generatorFuncJSDoc(apiItem: ApiData) {
    return `
    /**
    *@tagName ${_.get(apiItem, "tags[0]", "")}
    *@apiSummary ${apiItem.summary} 
    */`;
  }

  writeFile(title: string, codeString: string) {
    const filePath = path.join(this.config.output, `${title}Api.ts`);
    fse.outputFileSync(filePath, codeString);
    successLog(`${title} ts api write succeeded!`);
  }
}
