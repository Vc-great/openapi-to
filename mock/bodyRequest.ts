export const bodyRequestOpenApi3 = {
  requestBodies: {
    SzydDataUploadingTaskDto: {
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/SzydDataUploadingTaskDto",
          },
        },
      },
      description: "resources",
      required: true,
    },
  },
  components: {
    requestBodies: {
      SzydDataUploadingTaskDto: {
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/SzydDataUploadingTaskDto",
            },
          },
        },
        description: "resources",
        required: true,
      },
    },
    schemas: {
      SzydDataUploadingTaskDto: {
        type: "object",
        required: ["string", "byte"],
        properties: {
          string: {
            type: "string",
            description: "上报文件附件id",
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
          sourceType: {
            type: "string",
            description: "数据来源方式（db文件、视图、api接口、url等）",
            enum: ["DB_CONNECTION", "API_INTERFACE"],
          },
          batchId: {
            type: "integer",
            format: "int32",
            description: "批次ID",
          },
          exceptionIndexCount: {
            type: "integer",
            format: "int64",
            description: "异常指标数",
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
          dataIdList: {
            type: "array",
            description: "数据id集合",
            items: {
              type: "integer",
              format: "int64",
            },
          },
          dataUploadingModeDtoList: {
            type: "array",
            description: "数据上报指标",
            items: {
              $ref: "#/components/schemas/DataUploadingModeDto",
            },
          },
          hasOrgInfo: {
            type: "boolean",
            description: "是否有机构信息(0否、1是)",
          },
          delTime: {
            $ref: "#/components/schemas/Timestamp",
          },
          firstReturnTime: {
            $ref: "#/components/schemas/Timestamp",
          },
        },
        title: "SzydDataUploadingTaskDto",
      },
      DataUploadingModeDto: {
        type: "object",
        required: ["typeId"],
        properties: {
          columnName: {
            type: "string",
            description: "数据库列名",
          },
          columnTag: {
            type: "string",
            description:
              "列标签(普通:REGULAR,所属企业:ORG_NAME,唯一标识:UNIQUE_FLAG,更新时间:UPDATE_TIME,数据名称:DATE_NAME)",
            enum: [
              "REGULAR",
              "ORG_NAME",
              "ORG_CODE",
              "GROUP_CODE",
              "UNIQUE_FLAG",
              "UPDATE_TIME",
              "DATA_NAME",
              "OPERATION_FLAG",
            ],
          },
          dataSize: {
            type: "integer",
            format: "int32",
            description: "指标数据长度",
          },
          dataType: {
            type: "string",
            description: "指标数据类型(number、text、longtext、boolean)",
            enum: ["CHAR", "INT", "TEXT", "FLOAT", "DATE", "ATTACHMENT"],
          },
          id: {
            type: "integer",
            format: "int64",
          },
          modeCode: {
            type: "string",
            description: "指标编码",
          },
          modeDescribe: {
            type: "string",
            description: "指标说明",
          },
          modeField: {
            type: "string",
            description: "指标标识",
          },
          modeName: {
            type: "string",
            description: "指标名称",
          },
          primaryKeyFlag: {
            type: "boolean",
            description: "是否表主键",
          },
          requiredFlag: {
            type: "boolean",
            description: "是否必填（0否，1是）",
          },
          typeId: {
            type: "integer",
            format: "int64",
            description: "数据类型id",
          },
          uniqueFlag: {
            type: "boolean",
            description: "是否表内唯一",
          },
          valueRules: {
            type: "string",
            description: "值约束",
          },
        },
        title: "DataUploadingModeDto",
      },
      Timestamp: {
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
        title: "Timestamp",
      },
    },
  },
};
export const bodyRequestOpenApi3Formatter = {
  path: "tasks",
  method: "post",
  description: "Task Controller",
  tags: ["任务管理"],
  summary: "新增dataUploadingTask",
  operationId: "createUsingPOST_10",
  requestBody: {
    $ref: "#/components/requestBodies/SzydDataUploadingTaskDto",
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
  "/**DataUploadingModeDto*/\n" +
  "        dataUploadingModeDtoList?:DataUploadingModeDto[]\n" +
  "/**是否有机构信息(0否、1是)*/\n" +
  "      hasOrgInfo?:boolean\n" +
  "/**Timestamp*/\n" +
  "      delTime?:Timestamp\n" +
  "/**Timestamp*/\n" +
  "      firstReturnTime?:Timestamp\n" +
  "            }";
