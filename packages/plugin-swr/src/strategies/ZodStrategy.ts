// strategies/ZodStrategy.ts
export interface ZodStrategy {
  getNamespace(): string
  getTypeImport(): string
}
