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
import {
  downLoadResponseType,
  generateUploadFormData,
  getParamsSerializer,
  numberEnum,
  prettierFile,
  stringEnum,
} from "./utils";
import { errorLog, successLog } from "./log";
import { BaseData } from "./BaseData";

export class GenerateTSApi extends BaseData implements GenerateCode {
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

  get bodyRequest() {
    return `${this.namespaceName}.${_.upperFirst(
      this.apiItem.requestName
    )}BodyRequest`;
  }

  get pathParametersType() {
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

    return _.chain(this.path.parameters)
      .map((parameter) => {
        if ("$ref" in parameter) return "";
        return `${_.camelCase(parameter.name)}:${formatterBaseType(
          parameter.schema
        )}`;
      })
      .join()
      .value();
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
    const tagDescription = _.get(_.head(tagItem), "tagDescription", "");
    return `/**
           *@tagName ${name}.
           *@tagDescription ${tagDescription}.
           */`;
  }

  generatorFuncContent(apiItem: ApiData) {
    const { formDataHeader, uploadFormData } = generateUploadFormData(
      apiItem,
      this.openApi3SourceData
    );

    //函数参数
    const funcParams = [
      this.path.hasPathParameters ? this.pathParametersType : "",
      this.query.hasQueryParameters ? `query:${this.queryRequest}` : "",
      this.requestBody.hasRequestBodyParams ? `body:${this.bodyRequest}` : "",
    ]
      .filter((x) => x)
      .join();

    //todo application/x-www-form-urlencoded
    const contents = [
      `url:${this.path.url}`,
      this.query.hasQueryParameters ? "params:query" : "",
      this.requestBody.hasRequestBodyParams ? "data:body" : "",
      this.query.hasQueryArrayParameters
        ? getParamsSerializer(this.queryRequest)
        : "",
      downLoadResponseType(apiItem),
      formDataHeader,
    ];
    return ` ${
      apiItem.requestName
    }(${funcParams}):Promise<[ApiType.ErrorResponse,${
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
    return `/**
    *@apiSummary ${apiItem.summary} 
    */`;
  }

  writeFile(title: string, codeString: string) {
    const filePath = path.join(this.config.output, `${title}Api.ts`);
    fse.outputFileSync(filePath, codeString);
    successLog(`${title} ts api write succeeded!`);
  }
}
