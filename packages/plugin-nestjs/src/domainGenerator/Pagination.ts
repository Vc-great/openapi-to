import _ from "lodash";

import type { OpenAPIParameterObject } from "@openapi-to/core";

export class Pagination {
  constructor(
    private readonly parameters: Array<OpenAPIParameterObject> | undefined,
  ) {
    this.parameters = parameters;
  }

  get pageNoName(): string {
    return "pageNo";
  }

  get pageSizeName(): string {
    return "pageSize";
  }

  get pageNoParameterObject(): OpenAPIParameterObject | undefined {
    return _.find(this.parameters, (item) => item.name === "pageNo");
  }

  get pageSizeParameterObject(): OpenAPIParameterObject | undefined {
    return _.find(this.parameters, (item) => item.name === "pageSize");
  }

  get hasPagination(): boolean {
    const names = _.map(this.parameters, (item) => _.camelCase(item.name));

    return names.includes("pageNo") && names.includes("pageSize");
  }

  get paginationByParameters(): Array<OpenAPIParameterObject> {
    return _.chain(this.parameters)
      .filter((item: OpenAPIParameterObject) => {
        return this.hasPagination
          ? ["pageNo", "pageSize"].includes(_.camelCase(item.name))
          : false;
      })
      .value();
  }

  get filterPaginationByParameters(): Array<OpenAPIParameterObject> {
    return _.chain(this.parameters)
      .filter((item: OpenAPIParameterObject) => {
        return this.hasPagination
          ? !["pageNo", "pageSize"].includes(_.camelCase(item.name))
          : true;
      })
      .value();
  }

  get addPaginationDtoName() {
    return this.hasPagination ? "PaginationDto" : undefined;
  }
}
