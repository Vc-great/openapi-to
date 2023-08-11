export const uploadOpenApi3Formatter = {
  path: "tasks",
  method: "post",
  description: "Task Controller",
  tags: ["任务管理"],
  summary: "新增dataUploadingTask",
  operationId: "createUsingPOST_10",
  requestBody: {
    $ref: "#/components/requestBodies/createFileUsingPOST",
  },
  requestName: "create",
};

export const uploadOpenApi3 = {
  components: {
    requestBodies: {
      createFileUsingPOST: {
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

export const uploadExpectedResult =
  "\n" +
  "            /** 新增dataUploadingTask */\n" +
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
