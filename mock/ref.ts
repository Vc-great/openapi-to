export const bodyResponseOpenApi3 = {
  components: {
    schemas: {
      PageMetadata: {
        type: "object",
        properties: {
          number: {
            type: "integer",
            format: "int32",
            description: "页数",
          },
          numberOfElements: {
            type: "integer",
            format: "int64",
            description: "每页数量",
          },
          totalElements: {
            type: "integer",
            format: "int64",
            description: "总数量",
          },
          totalPages: {
            type: "integer",
            format: "int32",
            description: "总页数",
          },
        },
        title: "PageMetadata",
      },
      dataUploadingTask: {
        type: "object",
        properties: {
          attachmentId: {
            type: "string",
            description: "上报文件附件id",
          },
          attachmentName: {
            type: "string",
            description: "上报文件附件名",
          },
          batchId: {
            type: "integer",
            format: "int32",
            description: "批次ID",
          },
          businessTypeCode: {
            type: "string",
            description: "业务类型编码",
          },
          dataIdList: {
            type: "array",
            description: "关联数据id集合",
            items: {
              type: "integer",
              format: "int64",
            },
          },
          delFlag: {
            type: "integer",
            format: "int32",
            description: "删除标识(0未删除、1已删除)",
          },
          delTime: {
            $ref: "#/components/schemas/Timestamp",
          },
          exceptionIndexCount: {
            type: "integer",
            format: "int32",
            description: "异常指标数",
          },
          feedBackList: {
            type: "array",
            description: "反馈结果",
            items: {
              $ref: "#/components/schemas/Map_stringobject",
            },
          },
          firstReturnFeedBack: {
            type: "string",
            description: "首次返回结果json",
          },
          firstReturnFile: {
            type: "string",
            description: "首次返回结果文件id",
          },
          firstReturnTime: {
            $ref: "#/components/schemas/Timestamp",
          },
          id: {
            type: "integer",
            format: "int64",
            description: "ID",
          },
          remark: {
            type: "string",
            description: "备注",
          },
          returnFileId: {
            type: "integer",
            format: "int64",
            description: "国资委返回的文件id",
          },
          secondReturnFile: {
            type: "string",
            description: "二次返回结果文件id",
          },
          secondReturnTime: {
            $ref: "#/components/schemas/Timestamp",
          },
          startTime: {
            $ref: "#/components/schemas/Timestamp",
          },
          state: {
            type: "integer",
            format: "int32",
            description:
              "任务状态,0.待关联任务 1.已关联，待上报 2.已上报（调用国资委上报接口成功）",
          },
          subterminalTaskCollectionId: {
            type: "integer",
            format: "int64",
            description: "任务采集表id",
          },
          taskDescribe: {
            type: "string",
            description: "任务描述",
          },
          taskId: {
            type: "integer",
            format: "int64",
            description: "委端任务ID",
          },
          taskName: {
            type: "string",
            description: "任务名称",
          },
          taskType: {
            type: "integer",
            format: "int32",
            description: "任务类型 0测试数据1正式数据",
          },
          thirdReturnFile: {
            type: "string",
            description: "三次返回结果文件id",
          },
          thirdReturnTime: {
            $ref: "#/components/schemas/Timestamp",
          },
          uploadFiles: {
            type: "string",
            description: "上报文件id",
          },
          uploadFilesName: {
            type: "string",
            description: "上报文件db文件名",
          },
        },
        title: "dataUploadingTask",
      },
      Response_dataUploadingTask: {
        type: "object",
        properties: {
          code: {
            type: "integer",
            format: "int32",
            description: "状态码，非http status，是业务自定义的状态码",
          },
          content: {
            $ref: "#/components/schemas/dataUploadingTask",
          },
          message: {
            type: "string",
            description: "返回结果详细信息",
          },
          metadata: {
            $ref: "#/components/schemas/PageMetadata",
          },
          name: {
            type: "string",
          },
          timeConsumed: {
            type: "integer",
            format: "int64",
            description: "服务调用时长（ms）",
          },
          timestamp: {
            type: "string",
            format: "date-time",
            description: "服务器端的时间戳",
          },
          title: {
            type: "string",
            description: "返回结果摘要信息",
          },
          type: {
            type: "string",
            description: "code码对应的http uri说明",
          },
        },
        title: "Response«dataUploadingTask»",
      },
    },
  },
};
export const refList = ["#/components/schemas/Response_dataUploadingTask"];
export const bodyResponseExpectedResult =
  " export  interface Response_dataUploadingTask {\n" +
  "              /**状态码，非http status，是业务自定义的状态码*/\n" +
  "      code?:number\n" +
  "/**dataUploadingTask*/\n" +
  "      content?:DataUploadingTask\n" +
  "/**返回结果详细信息*/\n" +
  "      message?:string\n" +
  "/**PageMetadata*/\n" +
  "      metadata?:PageMetadata\n" +
  "/***/\n" +
  "      name?:string\n" +
  "/**服务调用时长（ms）*/\n" +
  "      timeConsumed?:number\n" +
  "/**\n" +
  "      *@remark RFC 3339 yyyy-MM-dd HH:mm:ss\n" +
  "      *@description 服务器端的时间戳\n" +
  "      */\n" +
  "      timestamp?:string\n" +
  "/**返回结果摘要信息*/\n" +
  "      title?:string\n" +
  "/**code码对应的http uri说明*/\n" +
  "      type?:string\n" +
  "             }\n" +
  " export  interface DataUploadingTask {\n" +
  "              /**上报文件附件id*/\n" +
  "      attachmentId?:string\n" +
  "/**上报文件附件名*/\n" +
  "      attachmentName?:string\n" +
  "/**批次ID*/\n" +
  "      batchId?:number\n" +
  "/**业务类型编码*/\n" +
  "      businessTypeCode?:string\n" +
  "/**关联数据id集合*/\n" +
  "      dataIdList?:number[]\n" +
  "/**删除标识(0未删除、1已删除)*/\n" +
  "      delFlag?:number\n" +
  "/**Timestamp*/\n" +
  "      delTime?:Timestamp\n" +
  "/**异常指标数*/\n" +
  "      exceptionIndexCount?:number\n" +
  "/**Map«string,object»*/\n" +
  "        feedBackList?:Map_stringobject[]\n" +
  "/**首次返回结果json*/\n" +
  "      firstReturnFeedBack?:string\n" +
  "/**首次返回结果文件id*/\n" +
  "      firstReturnFile?:string\n" +
  "/**Timestamp*/\n" +
  "      firstReturnTime?:Timestamp\n" +
  "/**ID*/\n" +
  "      id?:number\n" +
  "/**备注*/\n" +
  "      remark?:string\n" +
  "/**国资委返回的文件id*/\n" +
  "      returnFileId?:number\n" +
  "/**二次返回结果文件id*/\n" +
  "      secondReturnFile?:string\n" +
  "/**Timestamp*/\n" +
  "      secondReturnTime?:Timestamp\n" +
  "/**Timestamp*/\n" +
  "      startTime?:Timestamp\n" +
  "/**任务状态,0.待关联任务 1.已关联，待上报 2.已上报（调用国资委上报接口成功）*/\n" +
  "      state?:number\n" +
  "/**任务采集表id*/\n" +
  "      subterminalTaskCollectionId?:number\n" +
  "/**任务描述*/\n" +
  "      taskDescribe?:string\n" +
  "/**委端任务ID*/\n" +
  "      taskId?:number\n" +
  "/**任务名称*/\n" +
  "      taskName?:string\n" +
  "/**任务类型 0测试数据1正式数据*/\n" +
  "      taskType?:number\n" +
  "/**三次返回结果文件id*/\n" +
  "      thirdReturnFile?:string\n" +
  "/**Timestamp*/\n" +
  "      thirdReturnTime?:Timestamp\n" +
  "/**上报文件id*/\n" +
  "      uploadFiles?:string\n" +
  "/**上报文件db文件名*/\n" +
  "      uploadFilesName?:string\n" +
  "             }\n" +
  " export  interface PageMetadata {\n" +
  "              /**页数*/\n" +
  "      number?:number\n" +
  "/**每页数量*/\n" +
  "      numberOfElements?:number\n" +
  "/**总数量*/\n" +
  "      totalElements?:number\n" +
  "/**总页数*/\n" +
  "      totalPages?:number\n" +
  "             }\n" +
  " export  interface Timestamp {\n" +
  "              /***/\n" +
  "      date?:number\n" +
  "/***/\n" +
  "      day?:number\n" +
  "/***/\n" +
  "      hours?:number\n" +
  "/***/\n" +
  "      minutes?:number\n" +
  "/***/\n" +
  "      month?:number\n" +
  "/***/\n" +
  "      nanos?:number\n" +
  "/***/\n" +
  "      seconds?:number\n" +
  "/***/\n" +
  "      time?:number\n" +
  "/***/\n" +
  "      timezoneOffset?:number\n" +
  "/***/\n" +
  "      year?:number\n" +
  "             }\n" +
  " export  interface Map_stringobject {\n" +
  "              \n" +
  "             }";
