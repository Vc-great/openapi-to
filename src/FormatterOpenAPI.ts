import http from "http";
import https from "https";
import type { OpenAPIV2, OpenAPIV3 } from "openapi-types";
import converter from "do-swagger2openapi";
import type {
  Config,
  HttpMethod,
  HttpMethods,
  OpenApi3FormatData,
} from "./types";
import { ApiData } from "./types";
import _ from "lodash";
import fetch from "node-fetch";

/**
 * GenerateCode
 */
export class FormatterOpenAPI {
  public registerClass: unknown[];
  public openApiJson: OpenAPIV2.Document | OpenAPIV3.Document;
  public openApi3SourceData: OpenAPIV3.Document;
  public openApi3FormatData: OpenApi3FormatData;
  constructor(public config: Config) {
    this.config = config;
  }

  //注册
  public register(instance: unknown[]) {
    this.registerClass = instance;
  }

  public runByRegisterClass(apiItem: ApiData[]) {
    _.forEach(this.registerClass, (instance: any) => {
      const { title, codeString } = instance.run(apiItem);
      instance.writeFile(title, codeString);
    });
  }

  public async swagger2ToOpenapi3(
    openApiJson: OpenAPIV2.Document | OpenAPIV3.Document
  ) {
    if (!_.has(openApiJson, "swagger")) {
      return openApiJson;
    }
    // infoLog("💺 将 Swagger 转化为 openAPI");
    const [err, options] = await converter
      .convertObj(<OpenAPIV2.Document>openApiJson, {})
      .then(
        (options) => [undefined, options],
        (err) => [err, undefined]
      );
    if (err) {
      //todo log
      return {};
    }
    return options.openapi;
  }

  //数据转换
  public openApi3DataFormatter(openApi3SourceData: OpenAPIV3.Document) {
    const basePath = "";
    const openApi3FormatData = {};
    _.keys(openApi3SourceData.paths).forEach((p) => {
      const pathItem = openApi3SourceData.paths[p] as OpenAPIV3.PathItemObject;
      const httpMethods: HttpMethods = [
        "get",
        "put",
        "post",
        "delete",
        "patch",
      ];
      httpMethods.forEach((method) => {
        const operationObject: OpenAPIV3.OperationObject | undefined =
          pathItem[method];
        if (!operationObject) {
          return;
        }
        /**
         *x-swagger-router-controller：这个值需要设置成响应 API 请求的 controller 文件的名字。比如 controller 文件为hello_world.js， 那么关键词的值就是 hello_world。
         *operationId：这个值需要设置成响应 API 请求的 controller 文件中相应的方法。
         */
        //todo
        /*        const tags = operationObject["x-swagger-router-controller"]
          ? [operationObject["x-swagger-router-controller"]]
          : operationObject.tags || [operationObject.operationId] || [
              p.replace("/", "").split("/")[1],
            ];*/

        (operationObject.tags || []).forEach((tagString) => {
          // @ts-ignore
          openApi3FormatData[tagString] = openApi3FormatData[tagString] ?? [];

          // @ts-ignore
          openApi3FormatData[tagString].push({
            path: `${basePath}${p}`,
            method,
            tagDescription: openApi3SourceData.tags?.find(
              (x) => x.name === tagString
            )?.description,
            ...operationObject,
          });
        });
      });
    });
    //获取requestname
    return _.reduce(
      openApi3FormatData,
      (result: OpenApi3FormatData, value, tag) => {
        result[tag] = _.map(value, (item) => {
          return {
            // @ts-ignore
            ...item,
            requestName: this.generateRequestName(
              openApi3FormatData,
              // @ts-ignore
              item,
              // @ts-ignore
              item.path,
              // @ts-ignore
              <"get" | "put" | "post" | "delete" | "patch">item.method
            ),
          };
        });
        return result;
      },
      {}
    );
  }
  //todo delete /pet/{petId}
  // 生成请求名称
  private generateRequestName(
    openApi3FormatData: OpenApi3FormatData,
    apiItem: OpenAPIV3.OperationObject,
    path: string,
    method: HttpMethod
  ) {
    const tag = _.head(apiItem.tags) || "";
    const crudPath = this.getCrudRequestPath(openApi3FormatData[tag]);
    const methodUpperCase = method.toUpperCase();
    const lasePathParams = this.getPathLastParams(path);
    const name = new Map([
      ["GET", "list"],
      ["POST", "create"],
      ["PUT", "update"],
      ["DELETE", "del"],
      ["PATCH", "patch"],
      ["DETAIL", "detail"],
    ]);

    const isMatch = path === crudPath && name.has(methodUpperCase);

    if (isMatch) {
      return name.get(methodUpperCase);
    }

    //单个删除
    if (methodUpperCase === "DELETE" && lasePathParams) {
      return `delBy${_.upperFirst(_.camelCase(lasePathParams))}`;
    }

    const paths = path.split("/").filter((x) => x);
    const hasBracket = paths[paths.length - 1].includes("{");

    const detailPath = path.replace(/\/{([^/]+)}/g, "");

    const isDetail = detailPath === crudPath && methodUpperCase === "GET";

    //detail
    if (hasBracket && isDetail) {
      return name.get("DETAIL") + "By" + lasePathParams;
    }
    //其他带括号
    if (hasBracket) {
      const popItem = _.last(paths) || "";

      return _.camelCase(popItem.slice(1, popItem.length - 1));
    }

    return _.camelCase(paths[paths.length - 1]) + _.upperFirst(method);
  }

  //最短路径为crud路径
  public getCrudRequestPath(list: ApiData[]) {
    const obj = {
      path: "",
      length: Number.MAX_SAFE_INTEGER,
    };
    list.forEach((item) => {
      const paths = item.path.split("/").filter((x) => x);
      if (paths.length < obj.length) {
        obj.length = paths.length;
        obj.path = item.path;
      }
    });
    return obj.path;
  }

  //获取路径中最后一个参数
  getPathLastParams(path: string) {
    const pathParts = path.split("/");

    const part = pathParts[pathParts.length - 1];
    if (part.startsWith("{") && part.endsWith("}")) {
      return _.upperFirst(_.camelCase(part.slice(1, -1)));
    } else {
      return part;
    }
  }

  //根据路径获取schema
  async getSchema() {
    const schemaPath = this.config.path;
    if (schemaPath.startsWith("http")) {
      const protocol = schemaPath.startsWith("https:") ? https : http;
      const agent = new protocol.Agent({
        rejectUnauthorized: false,
      });
      const [error, res] = await fetch(schemaPath, { agent }).then(
        (res) => [undefined, res.json()],
        (e) => [e, undefined]
      );
      if (error) {
        console.log("fetch openapi error:", error);
        return {};
      }
      return res;
    }
    //本地文件
    const [error, res] = await import(schemaPath).then(
      (rest) => {
        return [undefined, rest.default];
      },
      (e) => [e, undefined]
    );
    if (error) {
      console.log("import openapi error:", error);
      return {};
    }
    return res;
  }

  //
  async init(): Promise<{
    openApi3SourceData: OpenAPIV3.Document;
    openApi3FormatData: OpenApi3FormatData;
  }> {
    //获取数据
    this.openApiJson = await this.getSchema();
    //数据转换
    this.openApi3SourceData = await this.swagger2ToOpenapi3(this.openApiJson);
    //格式化数据
    this.openApi3FormatData = this.openApi3DataFormatter(
      this.openApi3SourceData
    );
    return {
      openApi3SourceData: this.openApi3SourceData,
      openApi3FormatData: this.openApi3FormatData,
    };
  }

  //遍历生成代码
  public allRun() {
    //遍历path,调用注册类的run方法
    _.map(this.openApi3FormatData, (tagItem: ApiData[]) => {
      return this.runByRegisterClass(tagItem);
    });
  }

  //写入文件
  //wiriteFile() {}
}
