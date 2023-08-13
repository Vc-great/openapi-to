export const pathRequestOpenApi3 = {
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
};
export const pathRequestOpenApi3Formatter = {
  path: "tasks",
  method: "post",
  description: "Task Controller",
  tags: ["任务管理"],
  summary: "新增dataUploadingTask",
  operationId: "createUsingPOST_10",
  parameters: [
    {
      name: "fields",
      in: "path",
      description: "fields",
      required: false,
      explode: true,
      schema: {
        type: "integer",
        format: "int64",
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
  ],
  requestName: "create",
};

export const pathRequestExpectedResult =
  "/** 新增dataUploadingTask*/\n" +
  "          export interface CreatePathRequest {\n" +
  "                /** fields */\n" +
  "              fields?:number\n" +
  "/** id */\n" +
  "              id:number\n" +
  "            }";
