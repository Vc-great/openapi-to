// have json body params
export const bodyParamsBodyResultExpected =
  "\n" +
  "            /** 新增dataUploadingTask */\n" +
  "            export interface CreateBodyRequest {\n" +
  "              /**上报文件附件id*/\n" +
  "      string:string\n" +
  "/**\n" +
  "      *@remark content transferred with base64 encoding\n" +
  "      *@description byte\n" +
  "      */\n" +
  "      byte:string\n" +
  "/**\n" +
  "      *@remark content transferred in binary (octet-stream)\n" +
  "      *@description binary\n" +
  "      */\n" +
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
