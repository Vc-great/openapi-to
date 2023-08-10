[![build status](https://github.com/Vc-great/openapi-to/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Vc-great/openapi-to/actions/workflows/ci.yml)
[![codecov](https://codecov.io/github/Vc-great/openapi-to/branch/main/graph/badge.svg?token=5UB04YYCEB)](https://codecov.io/github/Vc-great/openapi-to)

# openapi-to

根据openapi接口文档生成typescript接口及类型声明。

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

## 生成目录结构
```bazaar


```

## api
```ts
//TODO: edit import
import type { ApiType } from "./types";
import request from "@/api/request";
/*
 *@tag名称 pet.
 *@tag描述 .
 */
class ApiName {
  /*
   *@tag名称: pet
   *@接口名称:uploads an image
   */
  uploadImage(
    petId: ApiType.UploadImagePathRequest,
    body: ApiType.UploadImageBodyRequest
  ): Promise<[object, ApiType.UploadImageResponse]> {
    //todo 上传文件
    const formData = new FormData();
    formData.append("file", file);

    return request.post({
      url: `/pet/${petId}/uploadImage`,
      data: body,
      headers: { "Content-Type": "multipart/form-data" },
    });
  }

  /*
   *@tag名称: pet
   *@接口名称:Update an existing pet
   */
  update(
    body: ApiType.UpdateBodyRequest
  ): Promise<[object, ApiType.UpdateResponse]> {
    return request.put({
      url: `/pet`,
      data: body,
    });
  }

  /*
   *@tag名称: pet
   *@接口名称:Add a new pet to the store
   */
  create(
    body: ApiType.CreateBodyRequest
  ): Promise<[object, ApiType.CreateResponse]> {
    return request.post({
      url: `/pet`,
      data: body,
    });
  }

  /*
   *@tag名称: pet
   *@接口名称:Finds Pets by status
   */
  findByStatus(
    query: ApiType.FindByStatusQueryRequest
  ): Promise<[object, ApiType.FindByStatusResponse]> {
    return request.get({
      url: `/pet/findByStatus`,
      params: query,
      paramsSerializer(params) {
        return qs.stringify(params);
      },
    });
  }

  /*
   *@tag名称: pet
   *@接口名称:Finds Pets by tags
   */
  findByTags(
    query: ApiType.FindByTagsQueryRequest
  ): Promise<[object, ApiType.FindByTagsResponse]> {
    return request.get({
      url: `/pet/findByTags`,
      params: query,
      paramsSerializer(params) {
        return qs.stringify(params);
      },
    });
  }

  /*
   *@tag名称: pet
   *@接口名称:Find pet by ID
   */
  detailByPetId(
    petId: ApiType.DetailByPetIdPathRequest
  ): Promise<[object, ApiType.DetailByPetIdResponse]> {
    return request.get({
      url: `/pet/${petId}`,
    });
  }

  /*
   *@tag名称: pet
   *@接口名称:Updates a pet in the store with form data
   */
  petId(
    petId: ApiType.PetIdPathRequest,
    body: ApiType.PetIdBodyRequest
  ): Promise<[object, ApiType.PetIdResponse]> {
    return request.post({
      url: `/pet/${petId}`,
      data: body,
    });
  }

  /*
   *@tag名称: pet
   *@接口名称:Deletes a pet
   */
  petId(
    petId: ApiType.PetIdPathRequest
  ): Promise<[object, ApiType.PetIdResponse]> {
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
 *@tag名称 pet
 *@Description
 */
//todo edit namespace name
export namespace ApiType {
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
  /**
   *@名称 uploads an image
   *@tag名称 pet
   */
  export interface UploadImagePathRequest {
    /** ID of pet to update */
    petId: number;
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
    /**undefined*/
    category?: Category;
    /***/
    name: string;
    /***/
    photoUrls: string[];
    /**undefined*/
    tags?: Tag[];
    /**pet status in the store*/
    status?: "available" | "pending" | "sold";
  }

  /** Update an existing pet */
  export interface UpdateResponse {}
  export interface Category {
    /***/
    id?: number;
    /***/
    name?: string;
  }
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
  /**
   *@名称 Find pet by ID
   *@tag名称 pet
   */
  export interface DetailByPetIdPathRequest {
    /** ID of pet to return */
    petId: number;
  }
  /** Find pet by ID */
  export interface DetailByPetIdResponse extends UpdateBodyRequest {}

  /** Updates a pet in the store with form data */
  export interface PetIdBodyRequest {
    /**Updated name of the pet*/
    name?: string;
    /**Updated status of the pet*/
    status?: string;
  }
  /**
   *@名称 Updates a pet in the store with form data
   *@tag名称 pet
   */
  export interface PetIdPathRequest {
    /** ID of pet that needs to be updated */
    petId: number;
  }

  /** Updates a pet in the store with form data */
  export interface PetIdResponse {}
  /**
   *@名称 Deletes a pet
   *@tag名称 pet
   */
  export interface PetIdPathRequest {
    /** Pet id to delete */
    petId: number;
  }

  /** Deletes a pet */
  export interface PetIdResponse {}
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
