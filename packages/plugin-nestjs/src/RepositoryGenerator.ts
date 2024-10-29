import { TypeormGenerator } from "./database/TypeormGenerator.ts";

import type { PluginContext } from "@openapi-to/core";
import type { Config } from "./types.ts";

export class RepositoryGenerator {
  private typeorm: TypeormGenerator;
  constructor(config: Config) {
    this.typeorm = new TypeormGenerator(config);
  }

  build(context: PluginContext): void {
    this.typeorm.build();
  }
}
