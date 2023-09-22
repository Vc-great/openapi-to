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
  prettierFile,
} from "./utils";
import { successLog } from "./log";
import { OpenAPI } from "./OpenAPI";

export class GenerateTSRequest extends OpenAPI implements GenerateCode {
  private readonly namespaceName: string;
  constructor(
    config: Config,
    openApi3SourceData: OpenAPIV3.Document,
    public openApi3FormatData: OpenApi3FormatData
  ) {
    super(openApi3SourceData, config);

    this.openApi3FormatData = openApi3FormatData;
    this.namespaceName = "ApiType";
  }

  get queryRequest() {
    return `${this.namespaceName}.${this.queryRequestName}`;
  }
  get pathRequest() {
    return `${this.namespaceName}.${this.pathRequestName}`;
  }

  get bodyRequest() {
    return `${this.namespaceName}.${this.bodyRequestName}`;
  }

  get hasZodDecorator() {
    return this.config.zodDecorator;
  }

  get pathParametersType() {
    return _.chain(this.path.parameters)
      .map((parameter) => {
        if ("$ref" in parameter) return "";
        const zodSchemaPath = `${this.lowerFirstPathRequestName}.shape.${parameter.name}`;
        return `${this.generatorZodPathDecorator(zodSchemaPath)}${_.camelCase(
          parameter.name
        )}:${this.pathRequest}['${parameter.name}']`;
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
            this.apiItem = apiItem;
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
           *@tag ${name ?? ""}.
           *@description ${tagDescription ?? ""}.
           */`;
  }

  get zodMethodDecorator() {
    if (this.hasZodDecorator) {
      return `@zodValidate
  @responseZodSchema(ZOD.${this.lowFirstResponseName})\n`;
    }
    return "";
  }

  generatorZodPathDecorator(zodSchema: string) {
    if (this.hasZodDecorator) {
      return `@paramsZodSchema(ZOD.${zodSchema})`;
    }
    return "";
  }
  generatorZodParamsDecorator(zodSchema: string) {
    if (this.hasZodDecorator) {
      return `@paramsZodSchema(ZOD.${zodSchema})`;
    }
    return "";
  }

  generatorFuncContent(apiItem: ApiData) {
    const { formDataHeader, uploadFormData } = generateUploadFormData(
      apiItem,
      this.openApi3SourceData
    );
    //函数参数
    const funcParams = [
      this.path.hasPathParameters ? this.pathParametersType : "",
      this.query.hasQueryParameters
        ? `${this.generatorZodParamsDecorator(
            this.lowerFirstQueryRequestName
          )}query:${this.queryRequest}`
        : "",
      this.requestBody.hasRequestBodyParams
        ? `${this.generatorZodParamsDecorator(
            this.lowerFirstBodyRequestName
          )}body:${this.bodyRequest}`
        : "",
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

    return `${this.zodMethodDecorator}${
      apiItem.requestName
    }(${funcParams}):Promise<[ApiType.ErrorResponse,${this.namespaceName}.${
      this.responseName
    }]>{${uploadFormData ? "\n" + uploadFormData + "\n" : ""}
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
    *@summary ${apiItem.summary ?? ""} 
    *@description ${apiItem.description ?? ""} 
    */`;
  }

  writeFile(title: string, codeString: string) {
    const filePath = path.join(this.config.output, `${title}Api.ts`);
    fse.outputFileSync(filePath, codeString);
    successLog(`${title} ts request write succeeded!`);
  }
}
