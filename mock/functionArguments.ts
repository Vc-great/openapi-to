export const queryRequestOpenApi3Formatter = {
  path: "tasks",
  method: "post",
  description: "Task Controller",
  tags: ["任务管理"],
  summary: "新增dataUploadingTask",
  operationId: "createUsingPOST_10",
  parameters: [
    {
      name: "fields",
      in: "query",
      description: "fields",
      required: false,
      explode: true,
      schema: {
        type: "array",
        items: {
          type: "string",
        },
      },
    },
    {
      name: "status",
      in: "query",
      description: "Status values that need to be considered for filter",
      required: true,
      explode: true,
      schema: {
        type: "array",
        items: {
          type: "string",
          enum: ["available", "pending", "sold"],
          default: "available",
        },
      },
    },
    {
      name: "tags",
      in: "query",
      description: "Tags to filter by",
      required: true,
      explode: true,
      schema: {
        type: "array",
        items: {
          type: "string",
        },
      },
    },
  ],
  requestName: "create",
};

export const queryRequestExpectedResult = {
  funcParams: "query:ApiType.CreateQueryRequest",
  requestParams: "params:query",
  typesName: ["ApiType.CreateQueryRequest"],
  paramsSerializer:
    "paramsSerializer(params) {\n            return qs.stringify(params)\n        }",
  formDataHeader: "",
  uploadFormData: "",
};

export const queryPathRequestOpenApi3Formatter = {
  path: "/pet",
  method: "post",
  description: "pet",
  tags: ["pet"],
  summary: "pet",
  operationId: "pet",
  parameters: [
    {
      name: "fields",
      in: "query",
      description: "fields",
      required: false,
      explode: true,
      schema: {
        type: "array",
        items: {
          type: "string",
        },
      },
    },
    {
      name: "status",
      in: "query",
      description: "Status values that need to be considered for filter",
      required: true,
      explode: true,
      schema: {
        type: "array",
        items: {
          type: "string",
          enum: ["available", "pending", "sold"],
          default: "available",
        },
      },
    },
    {
      name: "tags",
      in: "query",
      description: "Tags to filter by",
      required: true,
      explode: true,
      schema: {
        type: "array",
        items: {
          type: "string",
        },
      },
    },
    {
      name: "id",
      in: "path",
      description: "id",
      required: true,
      schema: {
        type: "integer",
        format: "int64",
      },
    },
    {
      name: "id2",
      in: "path",
      description: "id2",
      required: true,
      schema: {
        type: "integer",
        format: "int64",
      },
    },
  ],
  requestName: "create",
};

export const pathRequestOpenApi3Formatter = {
  path: "pet",
  method: "post",
  description: "pet",
  tags: ["pet"],
  summary: "pet",
  operationId: "pet",
  parameters: [
    {
      name: "id",
      in: "path",
      description: "id",
      required: true,
      schema: {
        type: "integer",
        format: "int64",
      },
    },
    {
      name: "id2",
      in: "path",
      description: "id2",
      required: true,
      schema: {
        type: "integer",
        format: "int64",
      },
    },
  ],
  requestName: "create",
};

export const pathBodyRequestOpenApi3Formatter = {
  path: "pet",
  method: "post",
  description: "pet",
  tags: ["pet"],
  summary: "pet",
  operationId: "pet",
  parameters: [
    {
      name: "id",
      in: "path",
      description: "id",
      required: true,
      schema: {
        type: "integer",
        format: "int64",
      },
    },
  ],
  requestBody: {
    $ref: "#/components/requestBodies/UserArray",
  },
  requestName: "create",
};

export const pathBodyRequestExpectedResult = {
  funcParams: "id:ApiType.CreatePathRequest,body:ApiType.CreateBodyRequest",
  requestParams: "data:body",
  typesName: ["ApiType.CreatePathRequest", "ApiType.CreateBodyRequest"],
  paramsSerializer: "",
  formDataHeader: "",
  uploadFormData: "",
};

export const bodyRequestOpenApi3Formatter = {
  path: "pet",
  method: "post",
  description: "pet",
  tags: ["pet"],
  summary: "pet",
  operationId: "pet",
  parameters: [],
  requestBody: {
    $ref: "#/components/requestBodies/UserArray",
  },
  requestName: "create",
};

export const bodyRequestExpected = {
  funcParams: "body:ApiType.CreateBodyRequest",
  requestParams: "data:body",
  typesName: ["ApiType.CreateBodyRequest"],
  paramsSerializer: "",
  formDataHeader: "",
  uploadFormData: "",
};
