export const jsApiExpected =
  "import request from '@/api/request';\n" +
  "/**\n" +
  " * error response\n" +
  " * @typedef {Object} ErrorResponse error\n" +
  " */\n" +
  "/**\n" +
  " *@apiSummary uploads an image\n" +
  " *@typedef {Object} UploadImageBodyRequest\n" +
  " *@param {string} body.additionalMetadata Additional data to pass to server\n" +
  " *@param {string} body.file file to upload\n" +
  " */\n" +
  "/**\n" +
  " *@apiSummary uploads an image\n" +
  " *@typedef {Object} UploadImageResponse\n" +
  " *@property {number} code\n" +
  " *@property {string} type\n" +
  " *@property {string} message\n" +
  " */\n" +
  "/**\n" +
  " *@apiSummary Update an existing pet\n" +
  " *@typedef {Object} UpdateBodyRequest\n" +
  " *@param {number} body.id\n" +
  " *@param {Category} body.category\n" +
  " *@param {string} [body.name]\n" +
  " *@param {string[]} [body.photoUrls]\n" +
  " *@param {Tag[]} body.tags\n" +
  " *@param {'available'|'pending'|'sold'} body.status pet status in the store\n" +
  " */\n" +
  "/**\n" +
  " *@apiSummary Updates a pet in the store with form data\n" +
  " *@typedef {Object} PetIdBodyRequest\n" +
  " *@param {string} body.name Updated name of the pet\n" +
  " *@param {string} body.status Updated status of the pet\n" +
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
  " *@tagDescription Everything about your Pets.\n" +
  " */\n" +
  "class ApiName {\n" +
  "    /**\n" +
  "     *@apiSummary uploads an image\n" +
  "     *@param {number} petId ID of pet to update\n" +
  "     *@param {UploadImageBodyRequest} body\n" +
  "     *@returns {Promise<[ErrorResponse, UploadImageResponse]>}\n" +
  "     */\n" +
  "    uploadImage(petId, body) {\n" +
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
  "     *@param {UpdateBodyRequest} body\n" +
  "     *@returns {Promise<[ErrorResponse, UpdateResponse]>}\n" +
  "     */\n" +
  "    update(body) {\n" +
  "        return request.put({\n" +
  "            url: `/pet`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@apiSummary Add a new pet to the store\n" +
  "     *@param {UpdateBodyRequest} body\n" +
  "     *@returns {Promise<[ErrorResponse, CreateResponse]>}\n" +
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
  "     *@returns {Promise<[ErrorResponse, FindByStatusResponse]>}\n" +
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
  "     *@returns {Promise<[ErrorResponse, FindByTagsResponse]>}\n" +
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
  "     *@returns {Promise<[ErrorResponse, UpdateBodyRequest]>}\n" +
  "     */\n" +
  "    detailByPetId(petId) {\n" +
  "        return request.get({\n" +
  "            url: `/pet/${petId}`,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@apiSummary Updates a pet in the store with form data\n" +
  "     *@param {number} petId ID of pet that needs to be updated\n" +
  "     *@param {PetIdBodyRequest} body\n" +
  "     *@returns {Promise<[ErrorResponse, PetIdResponse]>}\n" +
  "     */\n" +
  "    petId(petId, body) {\n" +
  "        return request.post({\n" +
  "            url: `/pet/${petId}`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@apiSummary Deletes a pet\n" +
  "     *@param {number} petId Pet id to delete\n" +
  "     *@returns {Promise<[ErrorResponse, DelByPetIdResponse]>}\n" +
  "     */\n" +
  "    delByPetId(petId) {\n" +
  "        return request.delete({\n" +
  "            url: `/pet/${petId}`,\n" +
  "        });\n" +
  "    }\n" +
  "}\n" +
  "const apiName = new ApiName();\n" +
  "\n" +
  "export { apiName };\n";
