import _ from "lodash";
import { BaseData } from "./BaseData";

export class Response {
  constructor(public baseData: BaseData) {
    this.baseData = baseData;
  }

  get ref() {
    let responses = _.values(_.get(this.baseData.apiItem, "responses", {}));

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
