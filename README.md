[![build status](https://github.com/Vc-great/openapi-to/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Vc-great/openapi-to/actions/workflows/ci.yml)
[![codecov](https://codecov.io/github/Vc-great/openapi-to/branch/main/graph/badge.svg?token=5UB04YYCEB)](https://codecov.io/github/Vc-great/openapi-to)

# openapi-to

根据 OpenAPI 规范接口文档生成 js-api(jsDoc),ts-api,ts-interface。

openapi 规范已支持:

- swagger2.0
- openapi3.0

## 文档

```js
openapi -h
Commands:
  init            初始化,生成配置文件
  install         生成代码
  i               生成代码（简写形式）
```

## 使用

安装

```ts
//全局安装,不侵入项目
npm i openapi-to -g
//验证
openapi -v
```

使用

```ts
//进⼊项⽬根⽬录下
cd project

//⽣成配置⽂件,自动将.yapi文件夹添加到.gitignore
openapi init

//在.openapi/openAPI.config.js中填写配置
module.exports = {
    projects:[
        {
            title:'测试',  //项目名称,用于生成目录
            path:'https://petstore.swagger.io/v2/swagger.json'  //接口文档url
        }
    ]
}

//生成api
openapi i
// or
openapi install
```

直接使用

```ts
// 生成openAPI.config.js
npx openapi-to init
// 根据openAPI.config.js生成文件
npx openapi-to i
```

## ts-api

```ts
//TODO: edit import
import type { ApiType } from "./types";
import request from "@/api/request";
/**
 *@tagName pet.
 *@tagDescription Everything about your Pets.
 */
class ApiName {
  /**
   *@apiSummary uploads an image
   */
  uploadImage(
    petId: number,
    body: ApiType.UploadImageBodyRequest
  ): Promise<[ApiType.ErrorResponse, ApiType.UploadImageResponse]> {
    //todo 上传文件
    const formData = new FormData();
    formData.append("file", file);

    return request.post({
      url: `/pet/${petId}/uploadImage`,
      data: body,
      headers: { "Content-Type": "multipart/form-data" },
    });
  }
  /**
   *@apiSummary Update an existing pet
   */
  update(
    body: ApiType.UpdateBodyRequest
  ): Promise<[ApiType.ErrorResponse, ApiType.UpdateResponse]> {
    return request.put({
      url: `/pet`,
      data: body,
    });
  }
  /**
   *@apiSummary Add a new pet to the store
   */
  create(
    body: ApiType.CreateBodyRequest
  ): Promise<[ApiType.ErrorResponse, ApiType.CreateResponse]> {
    return request.post({
      url: `/pet`,
      data: body,
    });
  }
  /**
   *@apiSummary Finds Pets by status
   */
  findByStatus(
    query: ApiType.FindByStatusQueryRequest
  ): Promise<[ApiType.ErrorResponse, ApiType.FindByStatusResponse]> {
    return request.get({
      url: `/pet/findByStatus`,
      params: query,
      paramsSerializer(params: ApiType.FindByStatusQueryRequest) {
        return qs.stringify(params);
      },
    });
  }
  /**
   *@apiSummary Finds Pets by tags
   */
  findByTags(
    query: ApiType.FindByTagsQueryRequest
  ): Promise<[ApiType.ErrorResponse, ApiType.FindByTagsResponse]> {
    return request.get({
      url: `/pet/findByTags`,
      params: query,
      paramsSerializer(params: ApiType.FindByTagsQueryRequest) {
        return qs.stringify(params);
      },
    });
  }
  /**
   *@apiSummary Find pet by ID
   */
  detailByPetId(
    petId: number
  ): Promise<[ApiType.ErrorResponse, ApiType.DetailByPetIdResponse]> {
    return request.get({
      url: `/pet/${petId}`,
    });
  }
  /**
   *@apiSummary Updates a pet in the store with form data
   */
  petId(
    petId: number,
    body: ApiType.PetIdBodyRequest
  ): Promise<[ApiType.ErrorResponse, ApiType.PetIdResponse]> {
    return request.post({
      url: `/pet/${petId}`,
      data: body,
    });
  }
  /**
   *@apiSummary Deletes a pet
   */
  delByPetId(
    petId: number
  ): Promise<[ApiType.ErrorResponse, ApiType.DelByPetIdResponse]> {
    return request.delete({
      url: `/pet/${petId}`,
    });
  }
}
const apiName = new ApiName();

export { apiName };
```

## interface

```ts
//eslint-disable-next-line @typescript-eslint/no-namespace
/**
 *@tagName pet
 *@description Everything about your Pets
 */
//todo edit namespace name
export namespace ApiType {
  /**error response*/
  export interface ErrorResponse {}
  /** uploads an image */
  export interface UploadImageBodyRequest {
    /**Additional data to pass to server*/
    additionalMetadata?: string;
    /**
     *@remark content transferred in binary (octet-stream)
     *@description file to upload
     */
    file?: string;
  }
  /** uploads an image */
  export interface UploadImageResponse {
    /***/
    code?: number;
    /***/
    type?: string;
    /***/
    message?: string;
  }
  /** Update an existing pet */
  export interface UpdateBodyRequest {
    /***/
    id?: number;
    /***/
    category?: Category;
    /***/
    name: string;
    /***/
    photoUrls: string[];
    /***/
    tags?: Tag[];
    /**pet status in the store*/
    status?: "available" | "pending" | "sold";
  }
  /** Update an existing pet */
  export interface UpdateResponse {}
  /***/
  export interface Category {
    /***/
    id?: number;
    /***/
    name?: string;
  }
  /***/
  export interface Tag {
    /***/
    id?: number;
    /***/
    name?: string;
  }
  /** Add a new pet to the store */
  export interface CreateBodyRequest extends UpdateBodyRequest {}
  /** Add a new pet to the store */
  export interface CreateResponse {}
  /** Finds Pets by status*/
  export interface FindByStatusQueryRequest {
    /** Status values that need to be considered for filter */
    status: string[];
  }
  /** Finds Pets by status */
  export interface FindByStatusResponse {}
  /** Finds Pets by tags*/
  export interface FindByTagsQueryRequest {
    /** Tags to filter by */
    tags: string[];
  }
  /** Finds Pets by tags */
  export interface FindByTagsResponse {}
  /** Find pet by ID */
  export interface DetailByPetIdResponse extends UpdateBodyRequest {}
  /** Updates a pet in the store with form data */
  export interface PetIdBodyRequest {
    /**Updated name of the pet*/
    name?: string;
    /**Updated status of the pet*/
    status?: string;
  }
  /** Updates a pet in the store with form data */
  export interface PetIdResponse {}
  /** Deletes a pet */
  export interface DelByPetIdResponse {}
}

/**pet status in the store*/
export const enum StatusLabel {
  available = "",
  pending = "",
  sold = "",
}
/**pet status in the store*/
export const enum Status {
  available = "available",
  pending = "pending",
  sold = "sold",
}
/**pet status in the store*/
export const StatusOption = [
  { label: StatusLabel.available, value: Status.available },
  { label: StatusLabel.pending, value: Status.pending },
  { label: StatusLabel.sold, value: Status.sold },
];
```

## js-api

```js
import request from "@/api/request";
/**
 * error response
 * @typedef {Object} ErrorResponse error
 */
/**
 *@apiSummary uploads an image
 *@typedef {Object} UploadImageBodyRequest
 *@param {string} body.additionalMetadata Additional data to pass to server
 *@param {string} body.file file to upload
 */
/**
 *@apiSummary uploads an image
 *@typedef {Object} UploadImageResponse
 *@property {number} code
 *@property {string} type
 *@property {string} message
 */
/**
 *@apiSummary Update an existing pet
 *@typedef {Object} UpdateBodyRequest
 *@param {number} body.id
 *@param {Category} body.category
 *@param {string} [body.name]
 *@param {string[]} [body.photoUrls]
 *@param {Tag[]} body.tags
 *@param {'available'|'pending'|'sold'} body.status pet status in the store
 */
/**
 *@apiSummary Updates a pet in the store with form data
 *@typedef {Object} PetIdBodyRequest
 *@param {string} body.name Updated name of the pet
 *@param {string} body.status Updated status of the pet
 */
/**
 *@title
 *@typedef {Object} Category
 *@property {number} id
 *@property {string} name
 */
/**
 *@title
 *@typedef {Object} Tag
 *@property {number} id
 *@property {string} name
 */

/**
 *@tagName pet.
 *@tagDescription Everything about your Pets.
 */
class ApiName {
  /**
   *@apiSummary uploads an image
   *@param {number} petId ID of pet to update
   *@param {UploadImageBodyRequest} body
   *@returns {Promise<[ErrorResponse, UploadImageResponse]>}
   */
  uploadImage(petId, body) {
    //todo 上传文件
    const formData = new FormData();
    formData.append("file", file);

    return request.post({
      url: `/pet/${petId}/uploadImage`,
      data: body,
      headers: { "Content-Type": "multipart/form-data" },
    });
  }
  /**
   *@apiSummary Update an existing pet
   *@param {UpdateBodyRequest} body
   *@returns {Promise<[ErrorResponse, UpdateResponse]>}
   */
  update(body) {
    return request.put({
      url: `/pet`,
      data: body,
    });
  }
  /**
   *@apiSummary Add a new pet to the store
   *@param {UpdateBodyRequest} body
   *@returns {Promise<[ErrorResponse, CreateResponse]>}
   */
  create(body) {
    return request.post({
      url: `/pet`,
      data: body,
    });
  }
  /**
   *@apiSummary Finds Pets by status
   *@param query
   *@param {string[]} query.status Status values that need to be considered for filter
   *@returns {Promise<[ErrorResponse, FindByStatusResponse]>}
   */
  findByStatus(query) {
    return request.get({
      url: `/pet/findByStatus`,
      params: query,
      paramsSerializer(params) {
        return qs.stringify(params);
      },
    });
  }
  /**
   *@apiSummary Finds Pets by tags
   *@param query
   *@param {string[]} query.tags Tags to filter by
   *@returns {Promise<[ErrorResponse, FindByTagsResponse]>}
   */
  findByTags(query) {
    return request.get({
      url: `/pet/findByTags`,
      params: query,
      paramsSerializer(params) {
        return qs.stringify(params);
      },
    });
  }
  /**
   *@apiSummary Find pet by ID
   *@param {number} petId ID of pet to return
   *@returns {Promise<[ErrorResponse, UpdateBodyRequest]>}
   */
  detailByPetId(petId) {
    return request.get({
      url: `/pet/${petId}`,
    });
  }
  /**
   *@apiSummary Updates a pet in the store with form data
   *@param {number} petId ID of pet that needs to be updated
   *@param {PetIdBodyRequest} body
   *@returns {Promise<[ErrorResponse, PetIdResponse]>}
   */
  petId(petId, body) {
    return request.post({
      url: `/pet/${petId}`,
      data: body,
    });
  }
  /**
   *@apiSummary Deletes a pet
   *@param {number} petId Pet id to delete
   *@returns {Promise<[ErrorResponse, DelByPetIdResponse]>}
   */
  delByPetId(petId) {
    return request.delete({
      url: `/pet/${petId}`,
    });
  }
}
const apiName = new ApiName();

export { apiName };
```
