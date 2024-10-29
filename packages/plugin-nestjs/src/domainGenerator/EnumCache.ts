import _ from "lodash";

import type { SchemaObject } from "oas/types";

export class EnumCache {
  private enumCache: Map<SchemaObject, string> = new Map<
    SchemaObject,
    string
  >();
  private name: { [key: string]: number } = {};
  constructor() {}

  entries(): Array<[SchemaObject, string]> {
    return [...this.enumCache.entries()];
  }
  getName(name: string): string {
    const index = this.name[name];

    this.name[name] = index ? index + 1 : 1;

    return name + (index || "");
  }

  set(schema: SchemaObject, name: string): void {
    this.enumCache.set(schema, name);
  }

  enumUnique(enumOfSchema: Array<unknown> | null): boolean {
    const enumOfSchemaString = enumOfSchema?.join() || "";
    return !_.chain([...this.enumCache.keys()])
      .some((schema) => enumOfSchemaString === schema.enum?.join())
      .value();
  }
}

let enumCache: EnumCache | null = null;

export function useEnumCache(): EnumCache {
  if (enumCache) {
    return enumCache;
  }
  enumCache = new EnumCache();
  return enumCache;
}
