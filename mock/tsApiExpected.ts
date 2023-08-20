export const tsApiExpected =
  "//TODO: edit import\n" +
  "import type { ApiType } from './types';\n" +
  "import request from '@/api/request';\n" +
  "/**\n" +
  " *@tagName pet.\n" +
  " *@tagDescription pet.\n" +
  " */\n" +
  "class ApiName {\n" +
  "    /**\n" +
  "     *@tagName pet\n" +
  "     *@apiSummary uploads an image\n" +
  "     */\n" +
  "    uploadImage(petId: number, body: ApiType.UploadImageBodyRequest): Promise<[object, ApiType.UploadImageResponse]> {\n" +
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
  "\n" +
  "    /**\n" +
  "     *@tagName pet\n" +
  "     *@apiSummary Update an existing pet\n" +
  "     */\n" +
  "    update(body: ApiType.UpdateBodyRequest): Promise<[object, ApiType.UpdateResponse]> {\n" +
  "        return request.put({\n" +
  "            url: `/pet`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "\n" +
  "    /**\n" +
  "     *@tagName pet\n" +
  "     *@apiSummary Add a new pet to the store\n" +
  "     */\n" +
  "    create(body: ApiType.CreateBodyRequest): Promise<[object, ApiType.CreateResponse]> {\n" +
  "        return request.post({\n" +
  "            url: `/pet`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "\n" +
  "    /**\n" +
  "     *@tagName pet\n" +
  "     *@apiSummary Finds Pets by status\n" +
  "     */\n" +
  "    findByStatus(query: ApiType.FindByStatusQueryRequest): Promise<[object, ApiType.FindByStatusResponse]> {\n" +
  "        return request.get({\n" +
  "            url: `/pet/findByStatus`,\n" +
  "            params: query,\n" +
  "            paramsSerializer(params: ApiType.FindByStatusQueryRequest) {\n" +
  "                return qs.stringify(params);\n" +
  "            },\n" +
  "        });\n" +
  "    }\n" +
  "\n" +
  "    /**\n" +
  "     *@tagName pet\n" +
  "     *@apiSummary Finds Pets by tags\n" +
  "     */\n" +
  "    findByTags(query: ApiType.FindByTagsQueryRequest): Promise<[object, ApiType.FindByTagsResponse]> {\n" +
  "        return request.get({\n" +
  "            url: `/pet/findByTags`,\n" +
  "            params: query,\n" +
  "            paramsSerializer(params: ApiType.FindByTagsQueryRequest) {\n" +
  "                return qs.stringify(params);\n" +
  "            },\n" +
  "        });\n" +
  "    }\n" +
  "\n" +
  "    /**\n" +
  "     *@tagName pet\n" +
  "     *@apiSummary Find pet by ID\n" +
  "     */\n" +
  "    detailByPetId(petId: number): Promise<[object, ApiType.DetailByPetIdResponse]> {\n" +
  "        return request.get({\n" +
  "            url: `/pet/${petId}`,\n" +
  "        });\n" +
  "    }\n" +
  "\n" +
  "    /**\n" +
  "     *@tagName pet\n" +
  "     *@apiSummary Updates a pet in the store with form data\n" +
  "     */\n" +
  "    petId(petId: number, body: ApiType.PetIdBodyRequest): Promise<[object, ApiType.PetIdResponse]> {\n" +
  "        return request.post({\n" +
  "            url: `/pet/${petId}`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "\n" +
  "    /**\n" +
  "     *@tagName pet\n" +
  "     *@apiSummary Deletes a pet\n" +
  "     */\n" +
  "    petId(petId: number): Promise<[object, ApiType.PetIdResponse]> {\n" +
  "        return request.delete({\n" +
  "            url: `/pet/${petId}`,\n" +
  "        });\n" +
  "    }\n" +
  "}\n" +
  "const apiName = new ApiName();\n" +
  "\n" +
  "export { apiName };\n";
