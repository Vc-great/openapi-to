export const jsApiExpected =
  "import request from '@/api/request';\n" +
  "/**\n" +
  " *uploads an image\n" +
  " *@typedef {Object} UploadImageResponse\n" +
  " *@property {number} code\n" +
  " *@property {string} type\n" +
  " *@property {string} message\n" +
  " */\n" +
  "/**\n" +
  " *@title\n" +
  " *@typedef {Object} Category\n" +
  " *@property {number} id\n" +
  " *@property {string} name\n" +
  " */\n" +
  "/**\n" +
  " *@title\n" +
  " *@typedef {Object} Tag\n" +
  " *@property {number} id\n" +
  " *@property {string} name\n" +
  " */\n" +
  "\n" +
  "/**\n" +
  " *@tagName pet.\n" +
  " *@tagDescription pet.\n" +
  " */\n" +
  "class ApiName {\n" +
  "    /**\n" +
  "     *@apiSummary uploads an image\n" +
  "     *@param {number} petId ID of pet to update\n" +
  "     *@param body\n" +
  "     *@param {string} body.additionalMetadata Additional data to pass to server\n" +
  "     *@param {string} body.file file to upload\n" +
  "     *@returns {Promise<[Object, UploadImageResponse]>}\n" +
  "     */\n" +
  "    uploadImage(body) {\n" +
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
  "     *@param body\n" +
  "     *@param {number} body.id\n" +
  "     *@param {Category} body.category\n" +
  "     *@param {string} [body.name]\n" +
  "     *@param {string[]} [body.photoUrls]\n" +
  "     *@param {Tag[]} body.tags\n" +
  "     *@param {'available'|'pending'|'sold'} body.status pet status in the store\n" +
  "     *@returns {Promise<[Object, UpdateResponse]>}\n" +
  "     */\n" +
  "    update(body) {\n" +
  "        return request.put({\n" +
  "            url: `/pet`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@apiSummary Add a new pet to the store\n" +
  "     *@returns {Promise<[Object, CreateResponse]>}\n" +
  "     */\n" +
  "    create(body) {\n" +
  "        return request.post({\n" +
  "            url: `/pet`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@apiSummary Finds Pets by status\n" +
  "     *@param query\n" +
  "     *@param {string[]} query.status Status values that need to be considered for filter\n" +
  "     *@returns {Promise<[Object, FindByStatusResponse]>}\n" +
  "     */\n" +
  "    findByStatus(query) {\n" +
  "        return request.get({\n" +
  "            url: `/pet/findByStatus`,\n" +
  "            params: query,\n" +
  "            paramsSerializer(params) {\n" +
  "                return qs.stringify(params);\n" +
  "            },\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@apiSummary Finds Pets by tags\n" +
  "     *@param query\n" +
  "     *@param {string[]} query.tags Tags to filter by\n" +
  "     *@returns {Promise<[Object, FindByTagsResponse]>}\n" +
  "     */\n" +
  "    findByTags(query) {\n" +
  "        return request.get({\n" +
  "            url: `/pet/findByTags`,\n" +
  "            params: query,\n" +
  "            paramsSerializer(params) {\n" +
  "                return qs.stringify(params);\n" +
  "            },\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@apiSummary Find pet by ID\n" +
  "     *@param {number} petId ID of pet to return\n" +
  "     *@returns {Promise<[Object, UpdateBodyRequest]>}\n" +
  "     */\n" +
  "    detailByPetId() {\n" +
  "        return request.get({\n" +
  "            url: `/pet/${petId}`,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@apiSummary Updates a pet in the store with form data\n" +
  "     *@param {number} petId ID of pet that needs to be updated\n" +
  "     *@param body\n" +
  "     *@param {string} body.name Updated name of the pet\n" +
  "     *@param {string} body.status Updated status of the pet\n" +
  "     *@returns {Promise<[Object, PetIdResponse]>}\n" +
  "     */\n" +
  "    petId(body) {\n" +
  "        return request.post({\n" +
  "            url: `/pet/${petId}`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@apiSummary Deletes a pet\n" +
  "     *@param {number} petId Pet id to delete\n" +
  "     *@returns {Promise<[Object, PetIdResponse]>}\n" +
  "     */\n" +
  "    petId() {\n" +
  "        return request.delete({\n" +
  "            url: `/pet/${petId}`,\n" +
  "        });\n" +
  "    }\n" +
  "}\n" +
  "const apiName = new ApiName();\n" +
  "\n" +
  "export { apiName };\n";
