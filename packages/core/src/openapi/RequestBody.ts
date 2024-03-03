import _ from "lodash";

import type { Operation } from "oas/operation";
import type { MediaTypeObject } from "oas/types";
export class RequestBody {
  constructor(private operation: Operation) {
    this.operation = operation;
  }

  get hasRequestBody(): boolean {
    return this.operation.hasRequestBody();
  }

  get isRequestBodyRequired(): boolean {
    return !!_.get(this.operation, "schema.requestBody.required");
  }

  get hasRef(): boolean {
    return !!_.get(this.operation, "schema.requestBody.$ref");
  }
  get ref(): string {
    return _.get(this.operation, "schema.requestBody.$ref", "");
  }

  /**
   * Content-type :application/json or Content-typec: *
   */
  get isJsonContainsDefaultCases(): boolean {
    const isJson = this.operation.isJson();
    //no set type.the default is json
    const isNoContentType = this.operation.getContentType() === "*/*";
    return isJson || isNoContentType;
  }

  get isFormUrlEncoded(): boolean {
    return this.operation.isFormUrlEncoded();
  }

  get isMultipart(): boolean {
    return this.operation.isFormUrlEncoded();
  }

  get getContentType(): string {
    return this.operation.getContentType();
  }

  getRequestBodySchema(
    mediaType?: string,
  ): false | MediaTypeObject | [string, MediaTypeObject, ...string[]] {
    return this.operation.getRequestBody(mediaType);
  }
}
