import { Project, StructureKind } from "ts-morph";

import type {
  ExportDeclarationStructure,
  SourceFileStructure,
  WriterFunction,
} from "ts-morph";
import type { VariableStatementStructure } from "ts-morph";
import type { MethodDeclarationStructure } from "ts-morph";
import type { ClassDeclarationStructure } from "ts-morph";
import type {
  ImportDeclarationStructure,
  OptionalKind,
  SourceFile,
} from "ts-morph";

type ImportStatementsOmitKind = Omit<ImportDeclarationStructure, "kind">;

export class AST {
  private project: Project;
  private sourceFile: Array<SourceFile>;
  constructor() {
    this.project = new Project();
    this.sourceFile = [];
  }

  createSourceFile(
    path: string,
    sourceFileText: string | OptionalKind<SourceFileStructure> | WriterFunction,
  ): void {
    const sourceFile = this.project.createSourceFile(path, sourceFileText, {
      overwrite: true,
    });
    sourceFile.formatText();
    this.sourceFile.push(sourceFile);
  }

  generateImportStatements(
    statements: Array<ImportStatementsOmitKind>,
  ): Array<ImportDeclarationStructure> {
    return statements.map((x: ImportStatementsOmitKind) => {
      return {
        ...x,
        kind: StructureKind.ImportDeclaration,
      };
    });
  }

  generateClassStatements(
    statements: Omit<ClassDeclarationStructure, "kind">,
  ): ClassDeclarationStructure {
    return {
      kind: StructureKind.Class,
      ...statements,
    };
  }

  generateMethodStatements(
    statement: Omit<MethodDeclarationStructure, "kind">,
  ): MethodDeclarationStructure {
    return {
      kind: StructureKind.Method,
      ...statement,
    };
  }

  generateVariableStatements(
    statement: Omit<VariableStatementStructure, "kind">,
  ): VariableStatementStructure {
    return {
      kind: StructureKind.VariableStatement,
      ...statement,
    };
  }

  generateExportDeclarationStatements(
    statement: Omit<ExportDeclarationStructure, "kind">,
  ): ExportDeclarationStructure {
    return {
      kind: StructureKind.ExportDeclaration,
      ...statement,
    };
  }

  async saveSync(): Promise<void> {
    const map = this.sourceFile.map((node) => node.save());
    await Promise.allSettled(map);
  }
}
