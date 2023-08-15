export const bodyRequestOpenApi3 = {
  requestBodies: {
    bodyRequest: {
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/bodyRequest",
          },
        },
      },
      description: "resources",
      required: true,
    },
  },
  components: {
    requestBodies: {
      bodyRequest: {
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/bodyRequest",
            },
          },
        },
        description: "resources",
        required: true,
      },
    },
    schemas: {
      bodyRequest: {
        type: "object",
        required: ["string", "byte"],
        properties: {
          string: {
            type: "string",
            description: "文件",
          },
          byte: {
            type: "string",
            format: "byte",
            description: "byte",
          },
          binary: {
            type: "string",
            format: "binary",
            description: "binary",
          },
          date: {
            type: "string",
            format: "date",
            description: "date",
          },
          date2: {
            type: "string",
            format: "date-time",
            description: "date-time",
          },
          password: {
            type: "string",
            format: "password",
            description: "password",
          },
          enums: {
            type: "string",
            description: "enums",
            enum: ["a", "b"],
          },
          int32: {
            type: "integer",
            format: "int32",
            description: "id",
          },
          int64: {
            type: "integer",
            format: "int64",
            description: "int64",
          },
          number: {
            type: "number",
            format: "number",
            description: "number",
          },
          double: {
            type: "number",
            format: "double",
            description: "double",
          },
          arrayList: {
            type: "array",
            description: "arrayList",
            items: {
              type: "integer",
              format: "int64",
            },
          },
          arrayRef: {
            type: "array",
            description: "arrayRef",
            items: {
              $ref: "#/components/schemas/arrayRef",
            },
          },
          boolean: {
            type: "boolean",
            description: "boolean",
          },
          time: {
            $ref: "#/components/schemas/time",
          },
          time2: {
            $ref: "#/components/schemas/time",
          },
        },
        title: "bodyRequest",
      },
      arrayRef: {
        type: "object",
        required: ["boolean"],
        properties: {
          name: {
            type: "string",
            description: "name",
          },
          enums: {
            type: "string",
            description: "enums",
            enums: ["a", "v", "s", "q", "w", "e", "r", "t"],
          },
          int32: {
            type: "integer",
            format: "int32",
            description: "int32",
          },
          int64: {
            type: "integer",
            format: "int64",
          },
          modeDescribe: {
            type: "string",
            description: "指标说明",
          },
          boolean: {
            type: "boolean",
            description: "boolean",
          },
        },
        title: "arrayRef",
      },
      time: {
        type: "object",
        properties: {
          date: {
            type: "integer",
            format: "int32",
          },
          day: {
            type: "integer",
            format: "int32",
          },
          hours: {
            type: "integer",
            format: "int32",
          },
          minutes: {
            type: "integer",
            format: "int32",
          },
          month: {
            type: "integer",
            format: "int32",
          },
          nanos: {
            type: "integer",
            format: "int32",
          },
          seconds: {
            type: "integer",
            format: "int32",
          },
          time: {
            type: "integer",
            format: "int64",
          },
          timezoneOffset: {
            type: "integer",
            format: "int32",
          },
          year: {
            type: "integer",
            format: "int32",
          },
        },
        title: "time",
      },
    },
  },
};
export const bodyRequestOpenApi3Formatter = {
  path: "pet",
  method: "post",
  description: "pet",
  tags: ["pet"],
  summary: "pet",
  operationId: "pet",
  requestBody: {
    $ref: "#/components/requestBodies/bodyRequest",
  },
  requestName: "create",
};

export const bodyRequestExpectedResult =
  "\n" +
  "            /** 新增dataUploadingTask */\n" +
  "            export interface createBodyRequest {\n" +
  "              /**上报文件附件id*/\n" +
  "      string:string\n" +
  "/**byte*/\n" +
  "      byte:string\n" +
  "/**binary*/\n" +
  "      binary?:string\n" +
  "/**\n" +
  "      *@remark RFC 3339 yyyy-MM-dd HH:mm:ss\n" +
  "      *@description date\n" +
  "      */\n" +
  "      date?:string\n" +
  "/**\n" +
  "      *@remark RFC 3339 yyyy-MM-dd HH:mm:ss\n" +
  "      *@description date-time\n" +
  "      */\n" +
  "      date2?:string\n" +
  "/**password*/\n" +
  "      password?:string\n" +
  "/**数据来源方式（db文件、视图、api接口、url等）*/\n" +
  "      sourceType?:'DB_CONNECTION'|'API_INTERFACE'\n" +
  "/**批次ID*/\n" +
  "      batchId?:number\n" +
  "/**异常指标数*/\n" +
  "      exceptionIndexCount?:number\n" +
  "/**number*/\n" +
  "      number?:number\n" +
  "/**double*/\n" +
  "      double?:number\n" +
  "/**数据id集合*/\n" +
  "      dataIdList?:number[]\n" +
  "/**arrayRef*/\n" +
  "        dataUploadingModeDtoList?:arrayRef[]\n" +
  "/**是否有机构信息(0否、1是)*/\n" +
  "      hasOrgInfo?:boolean\n" +
  "/**time*/\n" +
  "      delTime?:time\n" +
  "/**time*/\n" +
  "      firstReturnTime?:time\n" +
  "            }";
