export const tsApiExpected =
  "//TODO: edit import\n" +
  "import type { ApiType } from './types';\n" +
  "import request from '@/api/request';\n" +
  "/**\n" +
  " *@tag pet.\n" +
  " *@description Everything about your Pets.\n" +
  " */\n" +
  "class ApiName {\n" +
  "    /**\n" +
  "     *@summary summary\n" +
  "     *@description\n" +
  "     */\n" +
  "    testPut(body: ApiType.TestPutBodyRequest): Promise<[ApiType.ErrorResponse, ApiType.TestPutResponse]> {\n" +
  "        return request.put({\n" +
  "            url: `/pet/test`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary summary\n" +
  "     *@description\n" +
  "     */\n" +
  "    testPost(body: ApiType.TestPostBodyRequest): Promise<[ApiType.ErrorResponse, ApiType.TestPostResponse]> {\n" +
  "        return request.post({\n" +
  "            url: `/pet/test`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary summary\n" +
  "     *@description\n" +
  "     */\n" +
  "    delByTest(body: ApiType.DelByTestBodyRequest): Promise<[ApiType.ErrorResponse, ApiType.DelByTestResponse]> {\n" +
  "        return request.delete({\n" +
  "            url: `/pet/test`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary summary\n" +
  "     *@description\n" +
  "     */\n" +
  "    id(\n" +
  "        id: ApiType.IdPathRequest['id'],\n" +
  "        query: ApiType.IdQueryRequest\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.IdResponse]> {\n" +
  "        return request.get({\n" +
  "            url: `/pet/test/${id}`,\n" +
  "            params: query,\n" +
  "            paramsSerializer(params: ApiType.IdQueryRequest) {\n" +
  "                return qs.stringify(params);\n" +
  "            },\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary uploads an image\n" +
  "     *@description pet\n" +
  "     */\n" +
  "    uploadImagePost(\n" +
  "        petId: ApiType.UploadImagePostPathRequest['petId'],\n" +
  "        body: ApiType.UploadImagePostBodyRequest\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.UploadImagePostResponse]> {\n" +
  "        //todo 上传文件\n" +
  "        const formData = new FormData();\n" +
  "        formData.append('file', file);\n" +
  "\n" +
  "        return request.post({\n" +
  "            url: `/pet/${petId}/uploadImage`,\n" +
  "            data: body,\n" +
  "            headers: { 'Content-Type': 'multipart/form-data' },\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary Update an existing pet\n" +
  "     *@description\n" +
  "     */\n" +
  "    update(body: ApiType.UpdateBodyRequest): Promise<[ApiType.ErrorResponse, ApiType.UpdateResponse]> {\n" +
  "        return request.put({\n" +
  "            url: `/pet`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary Add a new pet to the store\n" +
  "     *@description\n" +
  "     */\n" +
  "    create(body: ApiType.CreateBodyRequest): Promise<[ApiType.ErrorResponse, ApiType.CreateResponse]> {\n" +
  "        return request.post({\n" +
  "            url: `/pet`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary Finds Pets by status\n" +
  "     *@description Multiple status values can be provided with comma separated strings\n" +
  "     */\n" +
  "    findByStatusGet(\n" +
  "        query: ApiType.FindByStatusGetQueryRequest\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.FindByStatusGetResponse]> {\n" +
  "        return request.get({\n" +
  "            url: `/pet/findByStatus`,\n" +
  "            params: query,\n" +
  "            paramsSerializer(params: ApiType.FindByStatusGetQueryRequest) {\n" +
  "                return qs.stringify(params);\n" +
  "            },\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary Finds Pets by tags\n" +
  "     *@description Multiple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.\n" +
  "     */\n" +
  "    findByTagsGet(\n" +
  "        query: ApiType.FindByTagsGetQueryRequest\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.FindByTagsGetResponse]> {\n" +
  "        return request.get({\n" +
  "            url: `/pet/findByTags`,\n" +
  "            params: query,\n" +
  "            paramsSerializer(params: ApiType.FindByTagsGetQueryRequest) {\n" +
  "                return qs.stringify(params);\n" +
  "            },\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary Find pet by ID\n" +
  "     *@description Returns a single pet\n" +
  "     */\n" +
  "    findByPetId(\n" +
  "        petId: ApiType.FindByPetIdPathRequest['petId']\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.FindByPetIdResponse]> {\n" +
  "        return request.get({\n" +
  "            url: `/pet/${petId}`,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary Updates a pet in the store with form data\n" +
  "     *@description\n" +
  "     */\n" +
  "    petId(\n" +
  "        petId: ApiType.PetIdPathRequest['petId'],\n" +
  "        body: ApiType.PetIdBodyRequest\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.PetIdResponse]> {\n" +
  "        return request.post({\n" +
  "            url: `/pet/${petId}`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary Deletes a pet\n" +
  "     *@description\n" +
  "     */\n" +
  "    delByPetId(\n" +
  "        petId: ApiType.DelByPetIdPathRequest['petId']\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.DelByPetIdResponse]> {\n" +
  "        return request.delete({\n" +
  "            url: `/pet/${petId}`,\n" +
  "        });\n" +
  "    }\n" +
  "}\n" +
  "const apiName = new ApiName();\n" +
  "\n" +
  "export { apiName };\n";
