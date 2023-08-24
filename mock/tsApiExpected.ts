export const tsApiExpected =
  "//TODO: edit import\n" +
  "import type { ApiType } from './types';\n" +
  "import request from '@/api/request';\n" +
  "/**\n" +
  " *@tagName pet.\n" +
  " *@tagDescription Everything about your Pets.\n" +
  " */\n" +
  "class ApiName {\n" +
  "    /**\n" +
  "     *@apiSummary uploads an image\n" +
  "     */\n" +
  "    uploadImage(\n" +
  "        petId: number,\n" +
  "        body: ApiType.UploadImageBodyRequest\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.UploadImageResponse]> {\n" +
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
  "     *@apiSummary Update an existing pet\n" +
  "     */\n" +
  "    update(body: ApiType.UpdateBodyRequest): Promise<[ApiType.ErrorResponse, ApiType.UpdateResponse]> {\n" +
  "        return request.put({\n" +
  "            url: `/pet`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@apiSummary Add a new pet to the store\n" +
  "     */\n" +
  "    create(body: ApiType.CreateBodyRequest): Promise<[ApiType.ErrorResponse, ApiType.CreateResponse]> {\n" +
  "        return request.post({\n" +
  "            url: `/pet`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@apiSummary Finds Pets by status\n" +
  "     */\n" +
  "    findByStatus(\n" +
  "        query: ApiType.FindByStatusQueryRequest\n" +
  "    ): Promise<[ApiType.ErrorResponse, ApiType.FindByStatusResponse]> {\n" +
  "        return request.get({\n" +
  "            url: `/pet/findByStatus`,\n" +
  "            params: query,\n" +
  "            paramsSerializer(params: ApiType.FindByStatusQueryRequest) {\n" +
  "                return qs.stringify(params);\n" +
  "            },\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@apiSummary Finds Pets by tags\n" +
  "     */\n" +
  "    findByTags(query: ApiType.FindByTagsQueryRequest): Promise<[ApiType.ErrorResponse, ApiType.FindByTagsResponse]> {\n" +
  "        return request.get({\n" +
  "            url: `/pet/findByTags`,\n" +
  "            params: query,\n" +
  "            paramsSerializer(params: ApiType.FindByTagsQueryRequest) {\n" +
  "                return qs.stringify(params);\n" +
  "            },\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@apiSummary Find pet by ID\n" +
  "     */\n" +
  "    detailByPetId(petId: number): Promise<[ApiType.ErrorResponse, ApiType.DetailByPetIdResponse]> {\n" +
  "        return request.get({\n" +
  "            url: `/pet/${petId}`,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@apiSummary Updates a pet in the store with form data\n" +
  "     */\n" +
  "    petId(petId: number, body: ApiType.PetIdBodyRequest): Promise<[ApiType.ErrorResponse, ApiType.PetIdResponse]> {\n" +
  "        return request.post({\n" +
  "            url: `/pet/${petId}`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@apiSummary Deletes a pet\n" +
  "     */\n" +
  "    delByPetId(petId: number): Promise<[ApiType.ErrorResponse, ApiType.DelByPetIdResponse]> {\n" +
  "        return request.delete({\n" +
  "            url: `/pet/${petId}`,\n" +
  "        });\n" +
  "    }\n" +
  "}\n" +
  "const apiName = new ApiName();\n" +
  "\n" +
  "export { apiName };\n";
