// have json body params
export const bodyParamsBodyExpected =
  "/** pet */\n" +
  "            export interface CreateBodyRequest {\n" +
  "              /**文件*/\n" +
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
  "/**enums*/\n" +
  "      enums?:'a'|'b'\n" +
  "/**id*/\n" +
  "      int32?:number\n" +
  "/**int64*/\n" +
  "      int64?:number\n" +
  "/**number*/\n" +
  "      number?:number\n" +
  "/**double*/\n" +
  "      double?:number\n" +
  "/**arrayList*/\n" +
  "      arrayList?:number[]\n" +
  "/**arrayRef*/\n" +
  "        arrayRef?:ArrayRef[]\n" +
  "/**boolean*/\n" +
  "      boolean?:boolean\n" +
  "/**time*/\n" +
  "      time?:Time\n" +
  "/**time*/\n" +
  "      time2?:Time\n" +
  "            }";
