import { ApiData } from "./types";
import { OpenAPIV3 } from "openapi-types";
import _ from "lodash";

export class Component {
  public resolveRefCache: Set<string>;
  public apiItem: ApiData;
  constructor(public openApi3SourceData: OpenAPIV3.Document) {
    this.openApi3SourceData = openApi3SourceData;
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
      this.openApi3SourceData,
      ref.split("/").slice(1).join(".")
    );
    return [component, this.resolveRefCache.has(ref)];
  }
}
