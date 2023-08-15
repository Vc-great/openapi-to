export const queryRequestOpenApi3Formatter = {
  path: "/pet/findByStatus",
  method: "get",
  description:
    "Multiple status values can be provided with comma separated strings",
  tags: ["pet"],
  summary: "Finds Pets by status",
  operationId: "findPetsByStatus",
  parameters: [
    {
      name: "1",
      in: "query",
      description: "2",
      required: false,
      schema: {
        type: "string",
      },
    },
    {
      name: "id2",
      in: "query",
      description: "ID",
      required: false,
      schema: {
        type: "integer",
        format: "int64",
      },
    },
    {
      name: "page",
      in: "query",
      description: "page",
      required: true,
      schema: {
        type: "integer",
        format: "int32",
      },
    },
    {
      name: "size",
      in: "query",
      description: "size",
      required: true,
      schema: {
        type: "integer",
        format: "int32",
      },
    },
    {
      name: "sort",
      in: "query",
      description: "",
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
      name: "time",
      in: "query",
      description: "时间",
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
      name: "state",
      in: "query",
      description: "状态",
      required: false,
      schema: {
        type: "integer",
        format: "int32",
      },
    },
    {
      name: "id",
      in: "query",
      description: "id",
      required: false,
      schema: {
        type: "integer",
        format: "int64",
      },
    },
    {
      name: "name",
      in: "query",
      description: "名称",
      required: false,
      schema: {
        type: "string",
      },
    },
    {
      name: "type",
      in: "query",
      description: "类型",
      required: false,
      schema: {
        type: "string",
      },
    },
    {
      name: "code",
      in: "query",
      description: "code",
      required: false,
      schema: {
        type: "string",
      },
    },
  ],
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": {
          schema: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Pet",
            },
          },
        },
        "application/xml": {
          schema: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Pet",
            },
          },
        },
      },
    },
    "400": {
      description: "Invalid status value",
    },
  },
  security: [
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  requestName: "findByStatus",
};

export const queryParamsResultExpected =
  "/** Finds Pets by status*/\n" +
  "    export interface FindByStatusQueryRequest {\n" +
  "                 /** 2 */\n" +
  "              1?:string\n" +
  "/** ID */\n" +
  "              id2?:number\n" +
  "/** page */\n" +
  "              page:number\n" +
  "/** size */\n" +
  "              size:number\n" +
  "/**  */\n" +
  "              sort?:string[]\n" +
  "/** 时间 */\n" +
  "              time?:string[]\n" +
  "/** 状态 */\n" +
  "              state?:number\n" +
  "/** id */\n" +
  "              id?:number\n" +
  "/** 名称 */\n" +
  "              name?:string\n" +
  "/** 类型 */\n" +
  "              type?:string\n" +
  "/** code */\n" +
  "              code?:string\n" +
  "            }";
