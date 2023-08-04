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
export const bodyResponseExpectedResult = "";
