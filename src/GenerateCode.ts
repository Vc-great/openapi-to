// @ts-nocheck
import http from "http";
import https from "https";
//import fetch from "node-fetch";
import { OpenAPIV2, OpenAPIV3 } from "openapi-types";
import converter from "do-swagger2openapi";
//import { infoLog } from "./log";
import type { Config, HttpMethod, HttpMethods } from "./types";
import { APIDataType, TagAPIDataType } from "./GenerateType";
//import { _.reduce, _.merge, has, keys, head } from "lodash-es";
import _ from "lodash";
import fetch from "node-fetch";

/**
 * GenerateCode
 */
export class GenerateCode {
  public registerClass: unknown[];
  public openApiJson: OpenAPIV2.Document | OpenAPIV3.Document;
  public openApi3Data: OpenAPIV3.Document;
  public openApi3FormatData: TagAPIDataType;
  constructor(public config: Config) {
    this.config = config;
    // this.openApiJson = {};
    // this.openApi3Data = {};
    //this.openApi3FormatData = {};
    // this.registerClass = [];
  }

  //注册
  public register(instance: unknown[]) {
    this.registerClass = instance;
  }

  public runByRegisterClass(apiItem: APIDataType) {
    return _.reduce(
      this.registerClass,
      (result, instance) => {
        const { title, codeString } = instance.run(apiItem);
        instance.writeFile(title, codeString);
      },
      {}
    );
  }

  public async swagger2ToOpenapi3(openApiJson) {
    if (!_.has(openApiJson, "swagger")) {
      return openApiJson;
    }
    // infoLog("💺 将 Swagger 转化为 openAPI");
    const [err, options] = await converter
      .convertObj(<OpenAPIV2.Document<{}>>openApiJson, {})
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
  public openApi3DataFormatter(openApi3Data) {
    // const { info } = this.openApi3Data;
    const basePath = "";
    //const version = info.version;
    const openApi3FormatData = {};
    _.keys(openApi3Data.paths).forEach((p) => {
      const pathItem = openApi3Data.paths[p] as OpenAPIV3.PathItemObject;
      //OpenAPIV3.HttpMethods
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

        // const tags = pathItem['x-swagger-router-controller']
        //   ? [pathItem['x-swagger-router-controller']]
        //   : operationObject.tags || [operationObject.operationId] || [
        //       p.replace('/', '').split('/')[1],
        //     ];

        const tags = operationObject["x-swagger-router-controller"]
          ? [operationObject["x-swagger-router-controller"]]
          : operationObject.tags || [operationObject.operationId] || [
              p.replace("/", "").split("/")[1],
            ];

        tags.forEach((tagString) => {
          // const tag = resolveTypeName(tagString);
          const tag = tagString;

          if (!openApi3FormatData[tag]) {
            openApi3FormatData[tag] = [];
          }
          const path = `${basePath}${p}`;
          openApi3FormatData[tag].push({
            path: `${basePath}${p}`,
            method,
            /* requestName: this.generateRequestName(
              operationObject,
              path,
              method
            ),*/
            description:
              openApi3Data.tags.find((x) => x.name === tag)?.description || "",
            ...operationObject,
          });
        });
      });
    });
    //获取requestname
    return _.reduce(
      openApi3FormatData,
      (result, value, tag) => {
        result[tag] = _.map(value, (item) => {
          return {
            ...item,
            requestName: this.generateRequestName(
              openApi3FormatData,
              item,
              item.path,
              item.method
            ),
          };
        });
        return result;
      },
      {}
    );
  }

  // 生成请求名称
  private generateRequestName(
    openApi3FormatData,
    apiItem: OpenAPIV3.OperationObject,
    path: string,
    method: HttpMethod
  ) {
    const tag = _.head(apiItem.tags) || "";
    const crudPath = this.getCrudRequestPath(openApi3FormatData[tag]);
    const methodUpperCase = method.toUpperCase();

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

    const paths = path.split("/").filter((x) => x);
    const hasBracket = paths[paths.length - 1].includes("{");

    const detailPath = path.replace(/\/{([^/]+)}/g, "");

    const isDetail = detailPath === crudPath && methodUpperCase === "GET";

    //detail
    if (hasBracket && isDetail) {
      return name.get("DETAIL") + "By" + this.getPathLastParams(path);
    }
    //其他带括号
    if (hasBracket) {
      const popItem = [...paths].pop();

      return _.camelCase(popItem.slice(1, popItem.length - 1));
    }

    return _.camelCase(paths[paths.length - 1]);
  }

  //最短路径为crud路径
  public getCrudRequestPath(list: APIDataType[]) {
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
      (rest) => [undefined, rest.default],
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
    openApi3SourceData: TagAPIDataType;
    openApi3FormatData: OpenAPIV3.Document;
  }> {
    //获取数据
    this.openApiJson = await this.getSchema();
    //数据转换
    this.openApi3Data = await this.swagger2ToOpenapi3(this.openApiJson);
    //格式化数据
    this.openApi3FormatData = this.openApi3DataFormatter(this.openApi3Data);
    return {
      openApi3SourceData: this.openApi3Data,
      openApi3FormatData: this.openApi3FormatData,
    };
  }

  //遍历生成代码
  public run() {
    //遍历path,调用注册类的run方法
    const map = _.map(this.openApi3FormatData, (apiItem, key) => {
      return this.runByRegisterClass(apiItem);
    });
  }

  //写入文件
  //wiriteFile() {}
}
