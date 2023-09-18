import _ from "lodash";
import { OpenAPI } from "./OpenAPI";
import { OpenAPIV3 } from "openapi-types";
import type { ResponseType } from "./types";

export class Response {
  constructor(public openAPI: OpenAPI) {
    this.openAPI = openAPI;
  }

  get apiItem() {
    return this.openAPI.apiItem;
  }

  get apiNameCache() {
    return this.openAPI.apiNameCache;
  }

  get schemas() {
    return this.openAPI.schemas;
  }

  get responseName() {
    return this.openAPI.responseName;
  }

  get ref() {
    let responses = _.values(_.get(this.apiItem, "responses", {}));

    let $ref = "";
    while (!$ref && !_.isEmpty(responses)) {
      const head = responses.shift();
      if (!head) {
        break;
      }

      if ("$ref" in head) {
        $ref = head.$ref;
        break;
      }
      //下一轮循环
      if (_.isEmpty(head.content)) {
        continue;
      }
      $ref = _.get(_.values(head.content)[0], "schema.$ref", "");
    }
    return $ref;
  }

  getComponent({
    withOutResponseRef,
    withOutApiNameCache,
    handleComponent,
  }: ResponseType.ResponseComponent) {
    const responseRef = this.ref;

    if (!responseRef) {
      return withOutResponseRef();
    }

    //已经解析过采用继承的方式
    if (this.apiNameCache.has(responseRef)) {
      return withOutApiNameCache(responseRef);
    }
    this.apiNameCache.set(responseRef, this.responseName);

    const component = this.schemas.getComponent(
      responseRef
    ) as OpenAPIV3.SchemaObject;

    return handleComponent(component);
  }
}
