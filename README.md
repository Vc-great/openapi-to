[![build status](https://github.com/Vc-great/openapi-to/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Vc-great/openapi-to/actions/workflows/ci.yml)
[![codecov](https://codecov.io/github/Vc-great/openapi-to/branch/main/graph/badge.svg?token=5UB04YYCEB)](https://codecov.io/github/Vc-great/openapi-to)

# openapi-to

根据 OpenAPI 规范接口文档生成:

- [x] js request(jsDoc)
- [x] ts request
- [x] ts interface
- [x] request object
- [x] zod
- [x] zod decorator
- [ ] form json
- [ ] nestjs controller
- [ ] nestjs dto

openapi 规范已支持:

- swagger 2.0
- openapi 3.0

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
    jsRequest:true,
    tsRequest:true,
    tsInterface:true,
    requestObject:true,
    zod:false,
    zodDecorator:false, // ts request file use zod decorator
    projects:[
        {
            title:'test',  //项目名称,用于生成目录
            path:'https://petstore.swagger.io/v2/swagger.json'  //接口文档url
        }
    ]
}

//生成api
openapi i
// or
openapi install
```

## zod

    增加zod主要用于端到端的校验.zodDecorator会在请求方法上增加三个方法,需要自己去实现具体逻辑,给出示例供大家参考
    - paramsZodSchema 收集请求参数zodSchema
    - responseZodSchema 收集响应数据zodSchema
    - zodValidate 根据zodSchema进行校验

```ts
import _ from "lodash";
export function zodValidate(target: object, propertyKey: string, descriptor) {
  const fn = descriptor.value;
  descriptor.value = async (...args) => {
    args.forEach((item, index) => {
      const zodSchema = _.get(target, `_zodSchema.${propertyKey}.${index}`);
      if (!zodSchema) {
        return "";
      }
      const safeParse = zodSchema.safeParse(item);
      !safeParse.success &&
        console.error(`[${propertyKey}]request params error`, safeParse.error);
    });
    //
    const result = await fn(...args);
    //response 校验
    const responseZodSchema = _.get(
      target,
      `_zodSchema.${propertyKey}.responseZodSchema`
    );
    const safeParse = responseZodSchema.safeParse(result[1]);
    result[1] &&
      !safeParse.success &&
      console.error(`[${propertyKey}]response error`, safeParse.error);

    return result;
  };
}

export const responseZodSchema =
  (zodSchema) => (target: object, propertyKey: string, descriptor) => {
    _.set(target, `_zodSchema.${propertyKey}.responseZodSchema`, zodSchema);
  };

export const paramsZodSchema =
  (zodSchema) => (target: object, propertyKey: string, index) => {
    _.set(target, `_zodSchema.${propertyKey}.${index}`, zodSchema);
  };
```

<details> 
<summary>ts request</summary>

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

</details>

<details> 
<summary>ts interface</summary>

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

</details>

<details> 
<summary>js request</summary>

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

</details>

<details> 
<summary>request object</summary>

```ts
/** uploads an image */
const UploadImageBodyRequest = {
  /**Additional data to pass to server*/
  additionalMetadata: "",
  /**file to upload*/
  file: "",
};
/** Update an existing pet */
const UpdateBodyRequest = {
  /***/
  id: 0,
  /***/
  category: "",
  /***/
  name: "",
  /***/
  photoUrls: [],
  /***/
  tags: [],
  /**pet status in the store*/
  status: "",
};
/** Add a new pet to the store */
const CreateBodyRequest = UpdateBodyRequest;
const FindByStatusQueryRequest = {
  /** Status values that need to be considered for filter */
  status: "",
};
const FindByTagsQueryRequest = {
  /** Tags to filter by */
  tags: "",
};

/** Updates a pet in the store with form data */
const PetIdBodyRequest = {
  /**Updated name of the pet*/
  name: "",
  /**Updated status of the pet*/
  status: "",
};
```

</details>

<details> 
<summary>zod</summary>

```ts
//eslint-disable-next-line @typescript-eslint/no-namespace
import { z } from "zod";

/** uploads an image*/
const uploadImagePostPathRequest = z.object({
  /** ID of pet to update */
  petId: z.number(),
});
/** uploads an image */
const uploadImagePostBodyRequest = z.object({
  /**Additional data to pass to server*/
  additionalMetadata: z.string().optional(),
  /**
   *@remark content transferred in binary (octet-stream)
   *@description file to upload
   */
  file: z.string().optional(),
});
/** uploads an image */
const uploadImagePostResponse = z.object({
  /***/
  code: z.number().optional(),
  /***/
  type: z.string().optional(),
  /***/
  message: z.string().optional(),
});
/** Update an existing pet */
const updateBodyRequest = z.object({
  /***/
  id: z.number().optional(),
  /***/
  category: z.lazy(() => category.optional()),
  /***/
  name: z.string(),
  /***/
  photoUrls: z.string().array(),
  /***/
  tags: z.lazy(() => tag.optional().array()),
  /**pet status in the store*/
  status: z.enum(["available", "pending", "sold"]).optional(),
});
/** Update an existing pet */
const updateResponse = z.object({});
/***/
const category = z.object({
  /***/
  id: z.number().optional(),
  /***/
  name: z.string().optional(),
});
/***/
const tag = z.object({
  /***/
  id: z.number().optional(),
  /***/
  name: z.string().optional(),
});
/** Add a new pet to the store */
const createBodyRequest = z.lazy(() => updateBodyRequest.extend({}));
/** Add a new pet to the store */
const createResponse = z.object({});
/** Finds Pets by status*/
const findByStatusGetQueryRequest = z.object({
  /** Status values that need to be considered for filter */
  status: z.string(),
});
/** Finds Pets by status */
const findByStatusGetResponse = z.object({});
/** Finds Pets by tags*/
const findByTagsGetQueryRequest = z.object({
  /** Tags to filter by */
  tags: z.string(),
});
/** Finds Pets by tags */
const findByTagsGetResponse = z.object({});
/** Find pet by ID*/
const detailByPetIdPathRequest = z.object({
  /** ID of pet to return */
  petId: z.number(),
});
/** Find pet by ID */
const detailByPetIdResponse = z.lazy(() => updateBodyRequest.extend({}));
/** Updates a pet in the store with form data*/
const petIdPathRequest = z.object({
  /** ID of pet that needs to be updated */
  petId: z.number(),
});
/** Updates a pet in the store with form data */
const petIdBodyRequest = z.object({
  /**Updated name of the pet*/
  name: z.string().optional(),
  /**Updated status of the pet*/
  status: z.string().optional(),
});
/** Updates a pet in the store with form data */
const petIdResponse = z.object({});
/** Deletes a pet*/
const delByPetIdPathRequest = z.object({
  /** Pet id to delete */
  petId: z.number(),
});
/** Deletes a pet */
const delByPetIdResponse = z.object({});

/**
 *@tag pet
 *@description Everything about your Pets
 */
//todo edit zod name
export const ZOD = {
  /** uploads an image*/
  uploadImagePostPathRequest,
  /** uploads an image */
  uploadImagePostBodyRequest,
  /** uploads an image */
  uploadImagePostResponse,
  /** Update an existing pet */
  updateBodyRequest,
  /** Update an existing pet */
  updateResponse,
  /**undefined*/
  category,
  /**undefined*/
  tag,
  /** Add a new pet to the store */
  createBodyRequest,
  /** Add a new pet to the store */
  createResponse,
  /** Finds Pets by status*/
  findByStatusGetQueryRequest,
  /** Finds Pets by status */
  findByStatusGetResponse,
  /** Finds Pets by tags*/
  findByTagsGetQueryRequest,
  /** Finds Pets by tags */
  findByTagsGetResponse,
  /** Find pet by ID*/
  detailByPetIdPathRequest,
  /** Find pet by ID */
  detailByPetIdResponse,
  /** Updates a pet in the store with form data*/
  petIdPathRequest,
  /** Updates a pet in the store with form data */
  petIdBodyRequest,
  /** Updates a pet in the store with form data */
  petIdResponse,
  /** Deletes a pet*/
  delByPetIdPathRequest,
  /** Deletes a pet */
  delByPetIdResponse,
};

/**
 *@tag pet
 *@description Everything about your Pets
 */
//todo edit namespace name
export namespace ApiType {
  /**error response*/
  export interface ErrorResponse {}
  /** uploads an image*/
  export type UploadImagePostPathRequest = z.infer<
    typeof uploadImagePostPathRequest
  >;
  /** uploads an image */
  export type UploadImagePostBodyRequest = z.infer<
    typeof uploadImagePostBodyRequest
  >;
  /** uploads an image */
  export type UploadImagePostResponse = z.infer<typeof uploadImagePostResponse>;
  /** Update an existing pet */
  export type UpdateBodyRequest = z.infer<typeof updateBodyRequest>;
  /** Update an existing pet */
  export type UpdateResponse = z.infer<typeof updateResponse>;
  /***/
  export type Category = z.infer<typeof category>;
  /***/
  export type Tag = z.infer<typeof tag>;
  /** Add a new pet to the store */
  export type CreateBodyRequest = z.infer<typeof createBodyRequest>;
  /** Add a new pet to the store */
  export type CreateResponse = z.infer<typeof createResponse>;
  /** Finds Pets by status*/
  export type FindByStatusGetQueryRequest = z.infer<
    typeof findByStatusGetQueryRequest
  >;

  /** Finds Pets by status */
  export type FindByStatusGetResponse = z.infer<typeof findByStatusGetResponse>;
  /** Finds Pets by tags*/
  export type FindByTagsGetQueryRequest = z.infer<
    typeof findByTagsGetQueryRequest
  >;
  /** Finds Pets by tags */
  export type FindByTagsGetResponse = z.infer<typeof findByTagsGetResponse>;
  /** Find pet by ID*/
  export type DetailByPetIdPathRequest = z.infer<
    typeof detailByPetIdPathRequest
  >;
  /** Find pet by ID */
  export type DetailByPetIdResponse = z.infer<typeof detailByPetIdResponse>;
  /** Updates a pet in the store with form data*/
  export type PetIdPathRequest = z.infer<typeof petIdPathRequest>;
  /** Updates a pet in the store with form data */
  export type PetIdBodyRequest = z.infer<typeof petIdBodyRequest>;
  /** Updates a pet in the store with form data */
  export type PetIdResponse = z.infer<typeof petIdResponse>;
  /** Deletes a pet*/
  export type DelByPetIdPathRequest = z.infer<typeof delByPetIdPathRequest>;
  /** Deletes a pet */
  export type DelByPetIdResponse = z.infer<typeof delByPetIdResponse>;
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
export const statusOption = [
  { label: StatusLabel.available, value: Status.available },
  { label: StatusLabel.pending, value: Status.pending },
  { label: StatusLabel.sold, value: Status.sold },
];
```

</details>

<details> 
<summary>zod decorator</summary>

```ts
//TODO: edit import
import type { ApiType } from "./types";
import request from "@/api/request";
/**
 *@tag pet.
 *@description Everything about your Pets.
 */
class ApiName {
  /**
   *@summary uploads an image
   *@description
   */
  @zodValidate
  @responseZodSchema(ZOD.uploadImagePostResponse)
  uploadImagePost(
    @paramsZodSchema(ZOD.uploadImagePostPathRequest.shape.petId)
    petId: ApiType.UploadImagePostPathRequest["petId"],
    @paramsZodSchema(ZOD.uploadImagePostBodyRequest)
    body: ApiType.UploadImagePostBodyRequest
  ): Promise<[ApiType.ErrorResponse, ApiType.UploadImagePostResponse]> {
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
   *@summary Update an existing pet
   *@description
   */
  @zodValidate
  @responseZodSchema(ZOD.updateResponse)
  update(
    @paramsZodSchema(ZOD.updateBodyRequest) body: ApiType.UpdateBodyRequest
  ): Promise<[ApiType.ErrorResponse, ApiType.UpdateResponse]> {
    return request.put({
      url: `/pet`,
      data: body,
    });
  }
  /**
   *@summary Add a new pet to the store
   *@description
   */
  @zodValidate
  @responseZodSchema(ZOD.createResponse)
  create(
    @paramsZodSchema(ZOD.createBodyRequest) body: ApiType.CreateBodyRequest
  ): Promise<[ApiType.ErrorResponse, ApiType.CreateResponse]> {
    return request.post({
      url: `/pet`,
      data: body,
    });
  }
  /**
   *@summary Finds Pets by status
   *@description Multiple status values can be provided with comma separated strings
   */
  @zodValidate
  @responseZodSchema(ZOD.findByStatusGetResponse)
  findByStatusGet(
    @paramsZodSchema(ZOD.findByStatusGetQueryRequest)
    query: ApiType.FindByStatusGetQueryRequest
  ): Promise<[ApiType.ErrorResponse, ApiType.FindByStatusGetResponse]> {
    return request.get({
      url: `/pet/findByStatus`,
      params: query,
      paramsSerializer(params: ApiType.FindByStatusGetQueryRequest) {
        return qs.stringify(params);
      },
    });
  }
  /**
   *@summary Finds Pets by tags
   *@description Multiple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.
   */
  @zodValidate
  @responseZodSchema(ZOD.findByTagsGetResponse)
  findByTagsGet(
    @paramsZodSchema(ZOD.findByTagsGetQueryRequest)
    query: ApiType.FindByTagsGetQueryRequest
  ): Promise<[ApiType.ErrorResponse, ApiType.FindByTagsGetResponse]> {
    return request.get({
      url: `/pet/findByTags`,
      params: query,
      paramsSerializer(params: ApiType.FindByTagsGetQueryRequest) {
        return qs.stringify(params);
      },
    });
  }
  /**
   *@summary Find pet by ID
   *@description Returns a single pet
   */
  @zodValidate
  @responseZodSchema(ZOD.detailByPetIdResponse)
  detailByPetId(
    @paramsZodSchema(ZOD.detailByPetIdPathRequest.shape.petId)
    petId: ApiType.DetailByPetIdPathRequest["petId"]
  ): Promise<[ApiType.ErrorResponse, ApiType.DetailByPetIdResponse]> {
    return request.get({
      url: `/pet/${petId}`,
    });
  }
  /**
   *@summary Updates a pet in the store with form data
   *@description
   */
  @zodValidate
  @responseZodSchema(ZOD.petIdResponse)
  petId(
    @paramsZodSchema(ZOD.petIdPathRequest.shape.petId)
    petId: ApiType.PetIdPathRequest["petId"],
    @paramsZodSchema(ZOD.petIdBodyRequest) body: ApiType.PetIdBodyRequest
  ): Promise<[ApiType.ErrorResponse, ApiType.PetIdResponse]> {
    return request.post({
      url: `/pet/${petId}`,
      data: body,
    });
  }
  /**
   *@summary Deletes a pet
   *@description
   */
  @zodValidate
  @responseZodSchema(ZOD.delByPetIdResponse)
  delByPetId(
    @paramsZodSchema(ZOD.delByPetIdPathRequest.shape.petId)
    petId: ApiType.DelByPetIdPathRequest["petId"]
  ): Promise<[ApiType.ErrorResponse, ApiType.DelByPetIdResponse]> {
    return request.delete({
      url: `/pet/${petId}`,
    });
  }
}
const apiName = new ApiName();

export { apiName };
```

</details>
