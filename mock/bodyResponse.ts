export const bodyResponseOpenApi3 = {
  components: {
    schemas: {
      data: {
        type: "object",
        properties: {
          int32: {
            type: "integer",
            format: "int32",
            description: "页数",
          },
          int64: {
            type: "integer",
            format: "int64",
            description: "每页数量",
          },
          string: {
            type: "string",
            description: "string",
          },
          time: {
            $ref: "#/components/schemas/time",
          },
        },
        title: "data",
      },
      time: {
        type: "object",
        properties: {
          int32: {
            type: "integer",
            format: "int32",
            description: "页数",
          },
          int64: {
            type: "integer",
            format: "int64",
            description: "每页数量",
          },
          string: {
            type: "string",
            description: "string",
          },
          time: {
            $ref: "#/components/schemas/time",
          },
        },
        title: "data",
      },
    },
  },
};
export const bodyResponseOpenApi3Formatter = {
  path: "pet",
  method: "post",
  description: "pet",
  tags: ["pet"],
  summary: "pet",
  requestName: "create",
  responses: {
    "200": {
      description: "OK",
      content: {
        "*/*": {
          schema: {
            $ref: "#/components/schemas/data",
          },
        },
      },
    },
    "201": {
      description: "Created",
    },
    "401": {
      description: "Unauthorized",
    },
    "403": {
      description: "Forbidden",
    },
    "404": {
      description: "Not Found",
    },
  },
};

export const bodyResponseExpectedResult =
  "/** pet */\n" +
  "           export  interface CreateResponse {\n" +
  "              /**页数*/\n" +
  "      int32?:number\n" +
  "/**每页数量*/\n" +
  "      int64?:number\n" +
  "/**string*/\n" +
  "      string?:string\n" +
  "/**data*/\n" +
  "      time?:Time\n" +
  "            }";

export const ComponentTypeResponseExpectedResult =
  "/**3*/\n" +
  "      export  interface RefList {\n" +
  "              /***/\n" +
  "      content?:ApiResponse\n" +
  "/**string*/\n" +
  "      string?:string\n" +
  "/***/\n" +
  "      name?:string\n" +
  "/**title*/\n" +
  "      title?:string\n" +
  "/**type*/\n" +
  "      type?:string\n" +
  "             }\n" +
  "/***/\n" +
  "      export  interface ApiResponse {\n" +
  "              /***/\n" +
  "      code?:number\n" +
  "/***/\n" +
  "      type?:string\n" +
  "/***/\n" +
  "      message?:string\n" +
  "             }";
