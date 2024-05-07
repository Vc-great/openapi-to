import _ from "lodash";

import type { ValidationOptions } from "class-validator";
import type OasTypes from "oas/types";
import type { DecoratorStructure, OptionalKind } from "ts-morph";
import type { Config } from "../types.ts";

interface Option {
  schema: OasTypes.SchemaObject | undefined;
  required: boolean | undefined;
  validationOptions?: ValidationOptions | undefined;
}

export class ValidatorDecorator {
  private readonly openapi: Config["openapi"];
  constructor(config: Config) {
    this.openapi = config.openapi;
  }

  ValidatorNames(
    schemaObject: OasTypes.SchemaObject | undefined,
  ): Array<string> {
    const names = this.getDecoratorName(schemaObject);
    return names;
  }

  getDecoratorName(schemaObject: OasTypes.SchemaObject | undefined) {
    const names = [];
    switch (schemaObject?.type) {
      case "number":
        names.push("IsNumber");
        break;
      case "string":
        names.push("IsString");
        break;
      case "boolean":
        names.push("IsBoolean");
        break;
      // integer 也作为一个被支持的类型并被定义为不包含小数或指数部分的 JSON 数字。
      case "integer":
        names.push("IsNumber");
        break;
      case "array":
        this.getArrayDecoratorName(schemaObject).forEach(
          (decoratorName: string) => names.push(decoratorName),
        );
        break;
      case "object":
        this.getObjectDecoratorName(schemaObject).forEach(
          (decoratorName: string) => names.push(decoratorName),
        );
        break;
      default:
        return [];
    }
    return [...names, !schemaObject.required ? "IsOptional" : undefined]
      .filter(Boolean)
      .reduce((arr: Array<string>, item) => {
        if (!arr.includes(item)) {
          arr.push(item);
        }
        return arr;
      }, []);
  }

  getObjectDecoratorName(schemaObject: OasTypes.SchemaObject): Array<string> {
    const ref: string = _.get(schemaObject, "$ref", "");
    const schemaObjectByRef: OasTypes.SchemaObject | undefined = ref
      ? (this.openapi.findSchemaDefinition(ref) as OasTypes.SchemaObject)
      : schemaObject;

    const type = ref
      ? _.last(ref.split("/"))
      : _.upperFirst(schemaObjectByRef?.type as string);

    const propertyType = _.chain(schemaObjectByRef?.properties)
      .reduce((arr: Array<string>, value) => {
        const type =
          typeof value === "object" && "type" in value ? value?.type : "";
        switch (type) {
          case "number":
            arr.push("IsNumber");
            break;
          case "string":
            arr.push("IsString");
            break;
          case "boolean":
            arr.push("IsBoolean");
            break;
          case "integer":
            arr.push("IsNumber");
            break;
          case "array":
            arr.push("Type");
            break;
        }

        const required =
          typeof value === "object" && "required" in value
            ? value?.required
            : false;

        return [...arr].concat(required ? [] : ["IsOptional"]);
      }, [])
      .value();

    return _.chain([] as Array<string>)
      .concat(type ? ["Type"] : [])
      .concat(propertyType)
      .value();
  }

  getArrayDecoratorName(schemaObject: OasTypes.SchemaObject): Array<string> {
    const ref: string = _.get(schemaObject, "items.$ref", "");
    const schemaObjectByItems: OasTypes.SchemaObject | undefined = _.get(
      schemaObject,
      "items",
    );

    const type = ref ? _.last(ref.split("/")) : undefined;

    return _.chain([] as Array<string>)
      .concat(type ? ["Type"] : [])
      .concat(ref ? [] : this.getDecoratorName(schemaObjectByItems))
      .value();
  }

  getTypeName(type: string) {}

  generatorDecorator(
    schema: OasTypes.SchemaObject,
    required?: boolean | undefined,
  ): OptionalKind<DecoratorStructure>[] | undefined {
    return _.chain([] as OptionalKind<DecoratorStructure>[])
      .concat(this.getTypeDecorator({ schema, required }))
      .concat(required ? [] : this.IsOptional({ schema, required }))
      .value();
  }

  getTypeDecorator(option: Option): OptionalKind<DecoratorStructure>[] {
    switch (option.schema?.type) {
      case "number":
        return this.IsNumber(option);
      case "string":
        return this.IsString(option);
      case "boolean":
        return this.IsBoolean(option);
      // integer 也作为一个被支持的类型并被定义为不包含小数或指数部分的 JSON 数字。
      case "integer":
        return this.IsNumber(option);
      case "array":
        return this.IsArray(option);
      default:
        return [];
    }
  }

  IsArray(option: Option): OptionalKind<DecoratorStructure>[] {
    const ref: string = _.get(option.schema, "items.$ref", "");
    const schemaObject: OasTypes.SchemaObject | undefined = ref
      ? (this.openapi.findSchemaDefinition(ref) as OasTypes.SchemaObject)
      : _.get(option.schema, "items");

    const type = ref
      ? _.last(ref.split("/"))
      : _.upperFirst(schemaObject?.type as string);

    return _.chain(
      type
        ? [
            {
              name: "Type",
              arguments: [`()=>${type}`],
            },
          ]
        : ([] as OptionalKind<DecoratorStructure>[]),
    )
      .concat(
        this.getTypeDecorator({
          schema: schemaObject,
          required: false,
          validationOptions: { each: true },
        }),
      )
      .value();
  }

  IsOptional(option: Option): OptionalKind<DecoratorStructure>[] {
    return [
      {
        name: "IsOptional",
        arguments: [JSON.stringify(option.validationOptions)].filter(Boolean),
      },
    ];
  }
  IsString(option: Option): OptionalKind<DecoratorStructure>[] {
    return [
      {
        name: "IsString",
        arguments: [JSON.stringify(option.validationOptions)].filter(Boolean),
      },
    ];
  }
  IsNumber(option: Option): OptionalKind<DecoratorStructure>[] {
    return [
      {
        name: "IsNumber",
        arguments: [JSON.stringify(option.validationOptions)].filter(Boolean),
      },
    ];
  }
  IsBoolean(option: Option): OptionalKind<DecoratorStructure>[] {
    //  @Type(() => Boolean)
    return [
      {
        name: "IsBoolean",
        arguments: [JSON.stringify(option.validationOptions)].filter(Boolean),
      },
    ];
  }
}
