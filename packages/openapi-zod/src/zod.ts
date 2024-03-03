export class Zod {
  private currentType: string = "";

  head(): this {
    this.currentType = "z";
    return this;
  }

  optional(): this {
    const str = ".optional()";
    this.currentType += str;
    return this;
  }

  number(): this {
    const str = ".number()";
    this.currentType += str;
    return this;
  }
  string(): this {
    const str = ".string()";
    this.currentType += str;
    return this;
  }
  boolean(): this {
    const str = ".boolean()";
    this.currentType += str;
    return this;
  }
  array(type: string): this {
    const str = `${type}.array()`;
    this.currentType += str;
    return this;
  }
  unknown(): this {
    const str = `.unknown()`;
    this.currentType += str;
    return this;
  }

  object(object: string): this {
    const str = `.object(${object})`;
    this.currentType += str;
    return this;
  }
  union(unions: Array<string>): this {
    const str = `.union([${unions}])`;
    this.currentType += str;
    return this;
  }

  enum(enums: Array<string>): this {
    const str = `.enum([${enums}])`;
    this.currentType += str;
    return this;
  }

  lazy(name: string): this {
    const str = `.lazy(() => ${name})`;
    this.currentType += str;
    return this;
  }
  infer(name: string): this {
    const str = `.infer<typeof ${name}>`;
    this.currentType += str;
    return this;
  }
  value(): string {
    const str = this.currentType;
    this.currentType = "";
    return str;
  }

  toString(): string {
    return this.value();
  }
}
