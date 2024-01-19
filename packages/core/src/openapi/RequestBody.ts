import type { Operation } from "oas/operation";
export class RequestBody {
  constructor(private operation: Operation) {
    this.operation = operation;
  }

  get hasRequestBody(): boolean {
    return this.operation.hasRequestBody();
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
}
