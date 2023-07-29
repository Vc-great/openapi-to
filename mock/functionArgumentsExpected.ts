export const queryArguments = [
  "query:AllQueryRequest",
  "params:query",
  ["AllQueryRequest"],
];

export const functionContentByQuery =
  " list(query:AllQueryRequest):Promise<[object,ListResponse]>{\n" +
  "      return request.get({\n" +
  "        url:`tasks`,\n" +
  "params:query\n" +
  "      })\n" +
  "    }";

export const queryPathArguments = [
  "id:DetailByIdPathRequest,query:DetailByIdQueryRequest",
  "params:query",
  ["DetailByIdPathRequest", "DetailByIdQueryRequest"],
];

export const functionContentByQueryPath =
  " list(id:DetailByIdPathRequest,query:DetailByIdQueryRequest):Promise<[object,ListResponse]>{\n" +
  "      return request.get({\n" +
  "        url:`tasks`,\n" +
  "params:query\n" +
  "      })\n" +
  "    }";

export const pathArguments = [
  "taskId:CreateDbPathRequest",
  "",
  ["CreateDbPathRequest"],
];

export const functionContentByPath =
  " list(taskId:CreateDbPathRequest):Promise<[object,ListResponse]>{\n" +
  "      return request.get({\n" +
  "        url:`tasks`\n" +
  "      })\n" +
  "    }";
export const pathBodyArguments = [
  "taskId:AddRelateDataPathRequest,body:AddRelateDataBodyRequest",
  "data:body",
  ["AddRelateDataPathRequest", "AddRelateDataBodyRequest"],
];

export const functionContentByPathBody =
  " list(taskId:AddRelateDataPathRequest,body:AddRelateDataBodyRequest):Promise<[object,ListResponse]>{\n" +
  "      return request.get({\n" +
  "        url:`tasks`,\n" +
  "data:body\n" +
  "      })\n" +
  "    }";
export const bodyArguments = [
  "body:UpdateBodyRequest",
  "data:body",
  ["UpdateBodyRequest"],
];

export const functionContentByBody =
  " list(body:UpdateBodyRequest):Promise<[object,ListResponse]>{\n" +
  "      return request.get({\n" +
  "        url:`tasks`,\n" +
  "data:body\n" +
  "      })\n" +
  "    }";
