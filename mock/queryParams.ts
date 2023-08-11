export const queryParams =
  "/** 查询dataUploadingTask*/\n" +
  "    export interface ListQueryRequest {\n" +
  "                 /** 业务类型 */\n" +
  "              businessTypeCode?:string\n" +
  "/** ID */\n" +
  "              id?:number\n" +
  "/** 页码 (0..N)，默认为0 */\n" +
  "              page:number\n" +
  "/** 每页显示的数目,默认为10 */\n" +
  "              size:number\n" +
  "/** 以下列格式排序标准：property[,asc | desc]。 默认排序顺序为升序。 支持多种排序条件：如：id,asc */\n" +
  "              sort?:string[]\n" +
  "/** 启动时间 */\n" +
  "              startTime?:string[]\n" +
  "/** 状态 */\n" +
  "              state?:number\n" +
  "/** 委端任务id */\n" +
  "              taskId?:number\n" +
  "/** 任务名称 */\n" +
  "              taskName?:string\n" +
  "/** 任务类型0.测试数据，1.正式数据 */\n" +
  "              taskType?:string\n" +
  "/** 业务类型编码 */\n" +
  "              typeCode?:string\n" +
  "            }";
