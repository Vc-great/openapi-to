import { ApiData } from "./types";
import { OpenAPIV3 } from "openapi-types";
import _ from "lodash";
import { BaseData } from "./BaseData";

export class Schemas {
  public apiItem: ApiData;
  public resolveRefCache: Set<string>;
  constructor(public baseData: BaseData) {
    this.baseData = baseData;
    //已解析过的ref
    this.resolveRefCache = new Set();
  }

  setApiItem(apiItem: ApiData) {
    this.apiItem = apiItem;
  }

  clearCache() {
    this.resolveRefCache.clear();
  }

  //todo 优化
  getComponent(
    ref: string = ""
  ): [
    component: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
    isCache: boolean
  ] {
    this.resolveRefCache.add(ref);
    const component = _.get(
      this.baseData.openApi3SourceData,
      ref.split("/").slice(1).join(".")
    );
    return [component, this.resolveRefCache.has(ref)];
  }
}
