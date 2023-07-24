export const queryArguments = [
  "query:AllQueryRequest",
  "params:query",
  ["AllQueryRequest"],
];

export const functionContentByQuery =
  " list(query:AllQueryRequest):Promise<[object,listResponse]>{\n" +
  "      return request.get({\n" +
  "        url:`tasks`,\n" +
  "params:query\n" +
  "      })\n" +
  "    }";

export const queryPathArguments = [
  "id:detailByIdPathRequest,query:detailByIdQueryRequest",
  "params:query",
  ["detailByIdPathRequest", "detailByIdQueryRequest"],
];

export const functionContentByQueryPath =
  " list(id:detailByIdPathRequest,query:detailByIdQueryRequest):Promise<[object,listResponse]>{\n" +
  "      return request.get({\n" +
  "        url:`tasks`,\n" +
  "params:query\n" +
  "      })\n" +
  "    }";

export const pathArguments = [
  "task_id:CreateDbPathRequest",
  "",
  ["CreateDbPathRequest"],
];

export const functionContentByPath =
  " list(task_id:CreateDbPathRequest):Promise<[object,listResponse]>{\n" +
  "      return request.get({\n" +
  "        url:`tasks`\n" +
  "      })\n" +
  "    }";
export const pathBodyArguments = [
  "task_id:AddRelateDataPathRequest,body:AddRelateDataBodyRequest",
  "data:body",
  ["AddRelateDataPathRequest", "AddRelateDataBodyRequest"],
];

export const functionContentByPathBody =
  " list(task_id:AddRelateDataPathRequest,body:AddRelateDataBodyRequest):Promise<[object,listResponse]>{\n" +
  "      return request.get({\n" +
  "        url:`tasks`,\n" +
  "data:body\n" +
  "      })\n" +
  "    }";
export const bodyArguments = [
  "body:updateBodyRequest",
  "data:body",
  ["updateBodyRequest"],
];

export const functionContentByBody =
  " list(body:updateBodyRequest):Promise<[object,listResponse]>{\n" +
  "      return request.get({\n" +
  "        url:`tasks`,\n" +
  "data:body\n" +
  "      })\n" +
  "    }";
