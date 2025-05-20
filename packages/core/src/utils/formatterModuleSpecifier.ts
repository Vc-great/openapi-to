export function formatterModuleSpecifier(moduleSpecifier: string, hasExtension = true): string {
  if (!hasExtension) {
    return moduleSpecifier.replace(/\.ts$/, '')
  }
  //moduleSpecifier 没有以.ts结尾则增加.ts
  return moduleSpecifier.endsWith('.ts') ? moduleSpecifier : `${moduleSpecifier}.ts`
}
