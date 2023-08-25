import { ApiData } from "./types";
import _ from "lodash";

export class Response {
  public apiItem: ApiData;
  constructor() {}

  setApiItem(apiItem: ApiData) {
    this.apiItem = apiItem;
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
}
