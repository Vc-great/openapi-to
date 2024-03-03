import _ from "lodash";

import type Oas from "oas";
import type OasTypes from "oas/types";
import type { OpenAPIV3 } from "openapi-types";
import type { OpenAPIV3_1 } from "openapi-types";
import type { OpenAPI } from "./OpenAPI.ts";

type RequestBodies = {
  [key: string]:
    | OpenAPIV3.ReferenceObject
    | OpenAPIV3.RequestBodyObject
    | OpenAPIV3_1.RequestBodyObject
    | OpenAPIV3_1.ReferenceObject;
};

type RequestBodyObject = {
  [key: string]: OpenAPIV3.ReferenceObject | OasTypes.MediaTypeObject;
};

export class Component {
  constructor(private openapi: OpenAPI) {
    this.openapi = openapi;
  }
  get oas(): Oas {
    return this.openapi.oas;
  }

  get requestBodies(): RequestBodies | undefined {
    return this.oas.api.components?.requestBodies;
  }

  get schemas() {
    return this.oas.api.components?.schemas;
  }
  get requestBodyObject(): RequestBodyObject | null {
    const requestBodies = this.requestBodies;
    if (!requestBodies) {
      return null;
    }
    return _.chain(requestBodies)
      .reduce((result, requestBodyObject, key) => {
        if (this.openapi.isReference(requestBodyObject)) {
          result[key] = requestBodyObject;
        }

        if ("content" in requestBodyObject) {
          //todo other media
          result[key] = _.head(
            Object.values(requestBodyObject.content),
          ) as RequestBodyObject;
        }
        return result;
      }, {} as RequestBodyObject)
      .value();
  }
}
