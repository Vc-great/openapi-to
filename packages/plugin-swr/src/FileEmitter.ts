// emitter/FileEmitter.ts
import { Project, SourceFile } from 'ts-morph'
import type { HookFile } from '../types'

export class FileEmitter {
  constructor(private outputDir: string) {}

  public emitFiles(files: HookFile[]): void {
    // 遍历所有 HookFile，通过 ts-morph 将 AST 输出为文件
    files.forEach((file) => {
      // 利用 ts-morph 创建文件并保存到 this.outputDir 下，
      // 如：this.project.createSourceFile(`${this.outputDir}/${file.fileName}`, file.ast) 等
    })
    // 输出 index 文件以及 hook 文件
  }
}
