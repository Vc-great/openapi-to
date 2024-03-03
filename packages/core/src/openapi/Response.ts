import _ from "lodash";

import type { Operation } from "oas/operation";
import type { SchemaObject } from "oas/types";
import type OasTypes from "oas/types";
export class Response {
  constructor(private operation: Operation) {
    this.operation = operation;
  }

  get getResponseStatusCodes() {
    return this.operation.getResponseStatusCodes();
  }
  getResponseAsJSONSchema(
    statusCode: string | number,
    opts?: {
      /**
       * If you wish to include discriminator mapping `$ref` components alongside your
       * `discriminator` in schemas. Defaults to `true`.
       */
      includeDiscriminatorMappingRefs?: boolean;
      /**
       * With a transformer you can transform any data within a given schema, like say if you want
       * to rewrite a potentially unsafe `title` that might be eventually used as a JS variable
       * name, just make sure to return your transformed schema.
       */
      transformer?: (schema: SchemaObject) => SchemaObject;
    },
  ): {
    description?: string;
    label: string;
    schema: OasTypes.SchemaObject;
    type: string | string[];
  }[] {
    return this.operation.getResponseAsJSONSchema(statusCode, opts);
  }

  get isDownLoad() {
    const downLoadKey = ["download", "export"];
    return _.some(downLoadKey, (key) => this.operation.path.includes(key));
  }
}
