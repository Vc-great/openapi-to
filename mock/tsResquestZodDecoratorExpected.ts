export const tsResquestZodDecoratorExpected =
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
  "    @zodValidate\n" +
  "    @responseZodSchema(ZOD.testPutResponse)\n" +
  "    testPut(\n" +
  "        @paramsZodSchema(ZOD.testPutBodyRequest) body: ApiType.TestPutBodyRequest\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.TestPutResponse]> {\n" +
  "        return request.put({\n" +
  "            url: `/pet/test`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary summary\n" +
  "     *@description\n" +
  "     */\n" +
  "    @zodValidate\n" +
  "    @responseZodSchema(ZOD.testPostResponse)\n" +
  "    testPost(\n" +
  "        @paramsZodSchema(ZOD.testPostBodyRequest) body: ApiType.TestPostBodyRequest\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.TestPostResponse]> {\n" +
  "        return request.post({\n" +
  "            url: `/pet/test`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary summary\n" +
  "     *@description\n" +
  "     */\n" +
  "    @zodValidate\n" +
  "    @responseZodSchema(ZOD.delByTestResponse)\n" +
  "    delByTest(\n" +
  "        @paramsZodSchema(ZOD.delByTestBodyRequest) body: ApiType.DelByTestBodyRequest\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.DelByTestResponse]> {\n" +
  "        return request.delete({\n" +
  "            url: `/pet/test`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary summary\n" +
  "     *@description\n" +
  "     */\n" +
  "    @zodValidate\n" +
  "    @responseZodSchema(ZOD.idResponse)\n" +
  "    id(\n" +
  "        @paramsZodSchema(ZOD.idPathRequest.shape.id) id: ApiType.IdPathRequest['id'],\n" +
  "        @paramsZodSchema(ZOD.idQueryRequest) query: ApiType.IdQueryRequest\n" +
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
  "    @zodValidate\n" +
  "    @responseZodSchema(ZOD.uploadImagePostResponse)\n" +
  "    uploadImagePost(\n" +
  "        @paramsZodSchema(ZOD.uploadImagePostPathRequest.shape.petId) petId: ApiType.UploadImagePostPathRequest['petId'],\n" +
  "        @paramsZodSchema(ZOD.uploadImagePostBodyRequest) body: ApiType.UploadImagePostBodyRequest\n" +
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
  "    @zodValidate\n" +
  "    @responseZodSchema(ZOD.updateResponse)\n" +
  "    update(\n" +
  "        @paramsZodSchema(ZOD.updateBodyRequest) body: ApiType.UpdateBodyRequest\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.UpdateResponse]> {\n" +
  "        return request.put({\n" +
  "            url: `/pet`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary Add a new pet to the store\n" +
  "     *@description\n" +
  "     */\n" +
  "    @zodValidate\n" +
  "    @responseZodSchema(ZOD.createResponse)\n" +
  "    create(\n" +
  "        @paramsZodSchema(ZOD.createBodyRequest) body: ApiType.CreateBodyRequest\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.CreateResponse]> {\n" +
  "        return request.post({\n" +
  "            url: `/pet`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary Finds Pets by status\n" +
  "     *@description Multiple status values can be provided with comma separated strings\n" +
  "     */\n" +
  "    @zodValidate\n" +
  "    @responseZodSchema(ZOD.findByStatusGetResponse)\n" +
  "    findByStatusGet(\n" +
  "        @paramsZodSchema(ZOD.findByStatusGetQueryRequest) query: ApiType.FindByStatusGetQueryRequest\n" +
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
  "    @zodValidate\n" +
  "    @responseZodSchema(ZOD.findByTagsGetResponse)\n" +
  "    findByTagsGet(\n" +
  "        @paramsZodSchema(ZOD.findByTagsGetQueryRequest) query: ApiType.FindByTagsGetQueryRequest\n" +
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
  "    @zodValidate\n" +
  "    @responseZodSchema(ZOD.detailByPetIdResponse)\n" +
  "    detailByPetId(\n" +
  "        @paramsZodSchema(ZOD.detailByPetIdPathRequest.shape.petId) petId: ApiType.DetailByPetIdPathRequest['petId']\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.DetailByPetIdResponse]> {\n" +
  "        return request.get({\n" +
  "            url: `/pet/${petId}`,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary Updates a pet in the store with form data\n" +
  "     *@description\n" +
  "     */\n" +
  "    @zodValidate\n" +
  "    @responseZodSchema(ZOD.petIdResponse)\n" +
  "    petId(\n" +
  "        @paramsZodSchema(ZOD.petIdPathRequest.shape.petId) petId: ApiType.PetIdPathRequest['petId'],\n" +
  "        @paramsZodSchema(ZOD.petIdBodyRequest) body: ApiType.PetIdBodyRequest\n" +
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
  "    @zodValidate\n" +
  "    @responseZodSchema(ZOD.delByPetIdResponse)\n" +
  "    delByPetId(\n" +
  "        @paramsZodSchema(ZOD.delByPetIdPathRequest.shape.petId) petId: ApiType.DelByPetIdPathRequest['petId']\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.DelByPetIdResponse]> {\n" +
  "        return request.delete({\n" +
  "            url: `/pet/${petId}`,\n" +
  "        });\n" +
  "    }\n" +
  "}\n" +
  "const apiName = new ApiName();\n" +
  "\n" +
  "export { apiName };\n";
