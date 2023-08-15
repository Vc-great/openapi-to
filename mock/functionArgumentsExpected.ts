export const queryArguments = [
  "query:AllQueryRequest",
  "params:query",
  ["AllQueryRequest"],
];

export const functionContentByQuery =
  " uploadImage(query:AllQueryRequest):Promise<[object,ApiType.UploadImageResponse]>{\n" +
  "      return request.post({\n" +
  "        url:`/pet/${petId}/uploadImage`,\n" +
  "params:query\n" +
  "      })\n" +
  "    }";

export const queryPathArguments = [
  "id:DetailByIdPathRequest,query:DetailByIdQueryRequest",
  "params:query",
  ["DetailByIdPathRequest", "DetailByIdQueryRequest"],
];

export const functionContentByQueryPath =
  " uploadImage(id:DetailByIdPathRequest,query:DetailByIdQueryRequest):Promise<[object,ApiType.UploadImageResponse]>{\n" +
  "      return request.post({\n" +
  "        url:`/pet/${petId}/uploadImage`,\n" +
  "params:query\n" +
  "      })\n" +
  "    }";

export const pathArguments = [
  "taskId:CreateDbPathRequest",
  "",
  ["CreateDbPathRequest"],
];

export const functionContentByPath =
  " uploadImage(taskId:CreateDbPathRequest):Promise<[object,ApiType.UploadImageResponse]>{\n" +
  "      return request.post({\n" +
  "        url:`/pet/${petId}/uploadImage`\n" +
  "      })\n" +
  "    }";
export const pathBodyArguments = [
  "taskId:AddRelateDataPathRequest,body:AddRelateDataBodyRequest",
  "data:body",
  ["AddRelateDataPathRequest", "AddRelateDataBodyRequest"],
];

export const functionContentByPathBody =
  " uploadImage(taskId:AddRelateDataPathRequest,body:AddRelateDataBodyRequest):Promise<[object,ApiType.UploadImageResponse]>{\n" +
  "      return request.post({\n" +
  "        url:`/pet/${petId}/uploadImage`,\n" +
  "data:body\n" +
  "      })\n" +
  "    }";
export const bodyArguments = [
  "body:UpdateBodyRequest",
  "data:body",
  ["UpdateBodyRequest"],
];

export const functionContentByBody =
  " uploadImage(body:UpdateBodyRequest):Promise<[object,ApiType.UploadImageResponse]>{\n" +
  "      return request.post({\n" +
  "        url:`/pet/${petId}/uploadImage`,\n" +
  "data:body\n" +
  "      })\n" +
  "    }";
