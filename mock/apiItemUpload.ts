export const uploadOpenApi3Formatter = {
  path: "pet",
  method: "post",
  description: "pet",
  tags: ["a"],
  summary: "pet",
  operationId: "pet",
  requestBody: {
    $ref: "#/components/requestBodies/uploadOpenApi",
  },
  requestName: "create",
};

export const uploadOpenApi3 = {
  components: {
    requestBodies: {
      uploadOpenApi: {
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              properties: {
                file: {
                  description: "file",
                  type: "string",
                  format: "binary",
                },
                file1: {
                  description: "file",
                  type: "string",
                  format: "byte",
                },
              },
              required: ["file"],
            },
          },
        },
        required: true,
      },
    },
    securitySchemes: {
      Authorization: {
        type: "apiKey",
        name: "Authorization",
        in: "header",
      },
    },
    schemas: {},
  },
};

export const uploadExpected =
  "/** pet */\n" +
  "            export interface CreateBodyRequest {\n" +
  "              /**\n" +
  "      *@remark content transferred in binary (octet-stream)\n" +
  "      *@description file\n" +
  "      */\n" +
  "      file:string\n" +
  "/**\n" +
  "      *@remark content transferred with base64 encoding\n" +
  "      *@description file\n" +
  "      */\n" +
  "      file1?:string\n" +
  "            }";
