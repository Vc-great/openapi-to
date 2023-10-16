export const jsApiExpected =
  "import request from '@/api/request';\n" +
  "/**\n" +
  " * error response\n" +
  " * @typedef {Object} ErrorResponse error\n" +
  " */\n" +
  "/**\n" +
  " *@summary summary\n" +
  " *@description\n" +
  " *@typedef {Object} TestPutBodyRequest\n" +
  " *@param {Test321[]} body.test321\n" +
  " */\n" +
  "/**\n" +
  " *@summary summary\n" +
  " *@description\n" +
  " *@typedef {Object} TestPutResponse\n" +
  " *@property {TestDto3} content testDto3\n" +
  " *@property {Testdata} meta title\n" +
  " */\n" +
  "/**\n" +
  " *@summary summary\n" +
  " *@description\n" +
  " *@typedef {Object} DelByTestResponse\n" +
  " *@property {number} code description\n" +
  " *@property {Testdata} meta title\n" +
  " */\n" +
  "/**\n" +
  " *@summary uploads an image\n" +
  " *@description pet\n" +
  " *@typedef {Object} UploadImagePostBodyRequest\n" +
  " *@param {string} body.additionalMetadata Additional data to pass to server\n" +
  " *@param {string} body.file file to upload\n" +
  " */\n" +
  "/**\n" +
  " *@summary uploads an image\n" +
  " *@description pet\n" +
  " *@typedef {Object} UploadImagePostResponse\n" +
  " *@property {number} code\n" +
  " *@property {string} type\n" +
  " *@property {string} message\n" +
  " */\n" +
  "/**\n" +
  " *@summary Update an existing pet\n" +
  " *@description\n" +
  " *@typedef {Object} UpdateBodyRequest\n" +
  " *@param {number} body.id\n" +
  " *@param {Category} body.category\n" +
  " *@param {string} [body.name]\n" +
  " *@param {string[]} [body.photoUrls]\n" +
  " *@param {Tag[]} body.tags\n" +
  " *@param {'available'|'pending'|'sold'} body.status pet status in the store\n" +
  " */\n" +
  "/**\n" +
  " *@summary Updates a pet in the store with form data\n" +
  " *@description\n" +
  " *@typedef {Object} PetIdBodyRequest\n" +
  " *@param {string} body.name Updated name of the pet\n" +
  " *@param {string} body.status Updated status of the pet\n" +
  " */\n" +
  "/**\n" +
  " *@title test321\n" +
  " *@typedef {Object} Test321\n" +
  " *@property {number} id\n" +
  " */\n" +
  "/**\n" +
  " *@title testDto3\n" +
  " *@typedef {Object} TestDto3\n" +
  " *@property {Test3214[]} test3214\n" +
  " */\n" +
  "/**\n" +
  " *@title title\n" +
  " *@typedef {Object} Testdata\n" +
  " *@property {number} number description\n" +
  " *@property {number} numberOfElements description\n" +
  " *@property {number} totalElements description\n" +
  " *@property {number} totalPages description\n" +
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
  "/**\n" +
  " *@title test3214\n" +
  " *@typedef {Object} Test3214\n" +
  " *@property {string} columnDefault 默认值\n" +
  " *@property {number} columnLength description\n" +
  " *@property {string} columnName description\n" +
  " *@property {string} columnRemark description\n" +
  " *@property {number} columnScale description\n" +
  " *@property {'CHAR'} columnType description\n" +
  " *@property {boolean} delFlag description\n" +
  " *@property {number} formId\n" +
  " *@property {number} id id\n" +
  " *@property {boolean} notNull description\n" +
  " */\n" +
  "\n" +
  "/**\n" +
  " *@tag pet\n" +
  " *@description Everything about your Pets\n" +
  " */\n" +
  "class ApiName {\n" +
  "    /**\n" +
  "     *@summary summary\n" +
  "     *@description\n" +
  "     *@param {TestPutBodyRequest} body\n" +
  "     *@returns {Promise<[ErrorResponse, TestPutResponse]>}\n" +
  "     */\n" +
  "    testPut(body) {\n" +
  "        return request.put({\n" +
  "            url: `/pet/test`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary summary\n" +
  "     *@description\n" +
  "     *@param {TestPutBodyRequest} body\n" +
  "     *@returns {Promise<[ErrorResponse, TestPutResponse]>}\n" +
  "     */\n" +
  "    testPost(body) {\n" +
  "        return request.post({\n" +
  "            url: `/pet/test`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary summary\n" +
  "     *@description\n" +
  "     *@param {number[]} body DelByTest\n" +
  "     *@returns {Promise<[ErrorResponse, DelByTestResponse]>}\n" +
  "     */\n" +
  "    delByTest(body) {\n" +
  "        return request.delete({\n" +
  "            url: `/pet/test`,\n" +
  "            data: body,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary summary\n" +
  "     *@description\n" +
  "     *@param query\n" +
  "     *@param {string[]} [query.fields] fields\n" +
  "     *@param {number} id id\n" +
  "     *@returns {Promise<[ErrorResponse, TestPutResponse]>}\n" +
  "     */\n" +
  "    id(id, query) {\n" +
  "        return request.get({\n" +
  "            url: `/pet/test/${id}`,\n" +
  "            params: query,\n" +
  "            paramsSerializer(params) {\n" +
  "                return qs.stringify(params);\n" +
  "            },\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary uploads an image\n" +
  "     *@description pet\n" +
  "     *@param {number} petId ID of pet to update\n" +
  "     *@param {UploadImagePostBodyRequest} body\n" +
  "     *@returns {Promise<[ErrorResponse, UploadImagePostResponse]>}\n" +
  "     */\n" +
  "    uploadImagePost(petId, body) {\n" +
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
  "     *@summary Add a new pet to the store\n" +
  "     *@description\n" +
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
  "     *@summary Finds Pets by status\n" +
  "     *@description Multiple status values can be provided with comma separated strings\n" +
  "     *@param query\n" +
  "     *@param {string[]} query.status Status values that need to be considered for filter\n" +
  "     *@returns {Promise<[ErrorResponse, FindByStatusGetResponse]>}\n" +
  "     */\n" +
  "    findByStatusGet(query) {\n" +
  "        return request.get({\n" +
  "            url: `/pet/findByStatus`,\n" +
  "            params: query,\n" +
  "            paramsSerializer(params) {\n" +
  "                return qs.stringify(params);\n" +
  "            },\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary Finds Pets by tags\n" +
  "     *@description Multiple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.\n" +
  "     *@param query\n" +
  "     *@param {string[]} query.tags Tags to filter by\n" +
  "     *@returns {Promise<[ErrorResponse, FindByTagsGetResponse]>}\n" +
  "     */\n" +
  "    findByTagsGet(query) {\n" +
  "        return request.get({\n" +
  "            url: `/pet/findByTags`,\n" +
  "            params: query,\n" +
  "            paramsSerializer(params) {\n" +
  "                return qs.stringify(params);\n" +
  "            },\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary Find pet by ID\n" +
  "     *@description Returns a single pet\n" +
  "     *@param {number} petId ID of pet to return\n" +
  "     *@returns {Promise<[ErrorResponse, UpdateBodyRequest]>}\n" +
  "     */\n" +
  "    findByPetId(petId) {\n" +
  "        return request.get({\n" +
  "            url: `/pet/${petId}`,\n" +
  "        });\n" +
  "    }\n" +
  "    /**\n" +
  "     *@summary Updates a pet in the store with form data\n" +
  "     *@description\n" +
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
  "     *@summary Deletes a pet\n" +
  "     *@description\n" +
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
