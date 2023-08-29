import { OpenAPIV3 } from "openapi-types";

/*//所选属性变必选
type WithRequiredProperty<Type, Key extends keyof Type> = Type & {
  [Property in Key]-?: Type[Property];
};*/

export type ConfigTemplate = {
  projects: Project[];
};

export interface Project {
  title: string;
  path: string;
}

export interface Config {
  projectDir: string;
  output: string;
  title: string;
  path: string;
}

export interface ApiData extends OpenAPIV3.OperationObject {
  path: string;
  method: string;
  requestName: string;
}

export interface OpenApi3FormatData {
  [k: string]: ApiData[];
}

export interface SchemaComponent {
  [key: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject;
}

export interface ParameterObject extends OpenAPIV3.ParameterBaseObject {
  name: string;
  in: string;
}

export type Parameters = (
  | OpenAPIV3.ReferenceObject
  | OpenAPIV3.ParameterObject
)[];
//export type TagApiData = Record<string, APIDataType[]>;

export interface GenerateCode {
  run: (tagItem: ApiData[]) => void;
}

export type HttpMethods = ["get", "put", "post", "delete", "patch"];

export type HttpMethod = "get" | "put" | "post" | "delete" | "patch";

export type ApiNameCache = Map<string, string>;

export type RefHasCache = (interfaceName: string, $ref: string) => string;
export type ArrayItems = (
  interfaceName: string,
  items: OpenAPIV3.SchemaObject
) => string;
export type BaseType = (
  interfaceName: string,
  component: OpenAPIV3.SchemaObject
) => string;
export type HandleComponent = (
  interfaceName: string,
  component: OpenAPIV3.SchemaObject
) => string;
export interface RequestBodyParams {
  refHasCache: RefHasCache;
  arrayItems: ArrayItems;
  baseType: BaseType;
  handleComponent: HandleComponent;
}

export namespace ResponseType {
  export type NotHaveResponseRef = (interfaceName: string) => string;

  export type NotHaveApiNameCache = (
    responseRef: string,
    interfaceName: string
  ) => string;

  export interface ResponseComponent {
    notHaveResponseRef: NotHaveResponseRef;
    notHaveApiNameCache: NotHaveApiNameCache;
    handleComponent: HandleComponent;
  }
}

export type SchemaCallBack<
  T = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
  M = OpenAPIV3.SchemaObject
> = ({
  schemaObject,
  component,
  parent,
  key,
}: {
  schemaObject: T;
  component: M;
  parent: OpenAPIV3.SchemaObject | undefined;
  key: string | undefined;
}) => string;

/*interface ArraySchemaObject extends OpenAPIV3.BaseSchemaObject {
  type: OpenAPIV3.ArraySchemaObjectType;
  items: OpenAPIV3.ReferenceObject;
}*/

export namespace ComponentSchema {
  export type SchemaObjectHas$Ref = SchemaCallBack<OpenAPIV3.ReferenceObject>;
  export type ArraySchemaObjectItemsHas$RefOfComponent = ({
    componentBySchemaObjectItemsRef,
    component,
    parent,
    key,
  }: {
    componentBySchemaObjectItemsRef: OpenAPIV3.ReferenceObject;
    component: OpenAPIV3.SchemaObject;
    parent: OpenAPIV3.SchemaObject | undefined;
    key: string | undefined;
  }) => string;

  export type ArrayItemSchemaCallBack = SchemaCallBack<OpenAPIV3.SchemaObject>;

  export type ArraySchemaObjectItemsHas$Ref = ({
    $ref,
    schemaObjectTitle,
    componentBySchemaObjectItemsRef,
    parent,
    key,
  }: {
    $ref: string;
    schemaObjectTitle: string | undefined;
    componentBySchemaObjectItemsRef: OpenAPIV3.SchemaObject;
    parent: OpenAPIV3.SchemaObject | undefined;
    key: string | undefined;
  }) => string;

  export type ArrayItemsNo$ref = ({
    schemaObjectItems,
    schemaObjectDescription,
    parent,
    key,
  }: {
    schemaObjectDescription: string | undefined;
    schemaObjectItems: OpenAPIV3.SchemaObject;
    parent: OpenAPIV3.SchemaObject | undefined;
    key: string | undefined;
  }) => string;

  export type ObjectNotHaveProperties = ({
    schemaObjectDescription,
    parent,
    key,
  }: {
    schemaObjectDescription: string | undefined;
    parent: OpenAPIV3.SchemaObject | undefined;
    key: string | undefined;
  }) => string;

  export type ObjectHasProperties = ({
    schemaObject,
  }: {
    schemaObject: OpenAPIV3.SchemaObject;
  }) => string;

  export type HasEnum = ({
    schemaObjectEnum,
    schemaObjectDescription,
    parent,
    key,
  }: {
    schemaObjectEnum: any[];
    schemaObjectDescription: string | undefined;
    parent: OpenAPIV3.SchemaObject | undefined;
    key: string;
  }) => string;

  export type BaseOfNumber = ({
    schemaObject,
    parent,
    key,
  }: {
    schemaObject: OpenAPIV3.SchemaObject;
    parent: OpenAPIV3.SchemaObject | undefined;
    key: string | undefined;
  }) => string;

  export type BaseOfString = ({
    schemaObject,
    parent,
    key,
  }: {
    schemaObject: OpenAPIV3.SchemaObject;
    parent: OpenAPIV3.SchemaObject | undefined;
    key: string | undefined;
  }) => string;

  export type BaseOfBoolean = ({
    schemaObject,
    parent,
    key,
  }: {
    schemaObject: OpenAPIV3.SchemaObject;
    parent: OpenAPIV3.SchemaObject | undefined;
    key: string | undefined;
  }) => string;
  export interface SchemaCallBackGather {
    schemaObjectHas$Ref: SchemaObjectHas$Ref;
    arraySchemaObjectItemsHas$RefOfComponent?: ArraySchemaObjectItemsHas$RefOfComponent;
    arraySchemaObjectItemsHas$Ref: ArraySchemaObjectItemsHas$Ref;
    arrayItemsNo$ref: ArrayItemsNo$ref;
    objectNotHaveProperties: ObjectNotHaveProperties;
    objectHasProperties: ObjectHasProperties;
    hasEnum: HasEnum;
    baseOfNumber: BaseOfNumber;
    baseOfString: BaseOfString;
    baseOfBoolean: BaseOfBoolean;
  }
}
