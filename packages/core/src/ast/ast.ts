import CodeBlockWriter from "code-block-writer";
import { Project, StructureKind, Writers } from "ts-morph";

import type {
  EnumDeclarationStructure,
  FunctionDeclarationStructure,
} from "ts-morph";
import type {
  ClassDeclarationStructure,
  ExportDeclarationStructure,
  ImportDeclarationStructure,
  InterfaceDeclarationStructure,
  MethodDeclarationStructure,
  ModuleDeclarationStructure,
  OptionalKind,
  PropertySignatureStructure,
  SourceFile,
  SourceFileStructure,
  TypeAliasDeclarationStructure,
  TypeElementMemberedNodeStructure,
  VariableStatementStructure,
  WriterFunction,
} from "ts-morph";
import type { JSDoc, ObjectStructure } from "./type.ts";

type ImportStatementsOmitKind = Omit<ImportDeclarationStructure, "kind">;
type InterfaceStatementsOmitKind = Omit<InterfaceDeclarationStructure, "kind">;

export class AST {
  public project: Project;
  public sourceFile: Array<SourceFile>;
  constructor() {
    this.project = new Project();
    this.sourceFile = [];
  }

  createSourceFile(
    path: string,
    sourceFileText: string | OptionalKind<SourceFileStructure> | WriterFunction,
  ): SourceFile {
    const sourceFile = this.project.createSourceFile(path, sourceFileText, {
      overwrite: true,
    });
    sourceFile.formatText();
    this.sourceFile.push(sourceFile);
    return sourceFile;
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

  generateFunctionStatements(
    statement: Omit<FunctionDeclarationStructure, "kind">,
  ): FunctionDeclarationStructure {
    return {
      kind: StructureKind.Function,
      ...statement,
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

  generateExportStatements(
    statement: Omit<ExportDeclarationStructure, "kind">,
  ): ExportDeclarationStructure {
    return {
      kind: StructureKind.ExportDeclaration,
      ...statement,
    };
  }

  generateModuleStatements(
    statement: Omit<ModuleDeclarationStructure, "kind">,
  ): ModuleDeclarationStructure {
    return {
      kind: StructureKind.Module,
      ...statement,
    };
  }

  generateTypeAliasStatements(
    statement: Omit<TypeAliasDeclarationStructure, "kind">,
  ): TypeAliasDeclarationStructure {
    return {
      kind: StructureKind.TypeAlias,
      ...statement,
    };
  }

  generateInterfaceStatements(
    statement: Omit<InterfaceDeclarationStructure, "kind">,
  ): InterfaceDeclarationStructure {
    return {
      kind: StructureKind.Interface,
      ...statement,
    };
  }

  generateObjectType(
    properties: OptionalKind<PropertySignatureStructure>[],
  ): string {
    const writer = new CodeBlockWriter();
    const statements: TypeElementMemberedNodeStructure = { properties };
    Writers.objectType(statements)(writer); //writer
    return writer.toString();
  }

  generateObject(object: { [key: string]: any }): string {
    const writer = new CodeBlockWriter();
    Writers.object(object)(writer);
    return writer.toString();
  }

  generateObject$2(objectStructure: Array<ObjectStructure>): string {
    const writer = new CodeBlockWriter();
    function writeDocs(docs: JSDoc) {
      writer.write("/**");
      docs.forEach((doc) => {
        const isLine = doc.description?.startsWith("\n");
        if (isLine || doc.tags) {
          writer.newLine();
          writer.write("*").write(doc.description || "");
        } else {
          writer.write(doc.description || "");
        }

        if (doc.tags) {
          writer.newLine();
          doc.tags.forEach((tag) => {
            writer.write("*@").write(tag.tagName);
            writer.write(":");
            writer.write(tag.text as string);
            writer.newLine();
          });
        }
      });
      writer.write("*/");
      writer.newLine();
    }
    writer.block(() => {
      objectStructure.forEach((item, index) => {
        if (index !== 0) {
          writer.newLine();
        }
        if (item.docs) {
          writeDocs(item.docs || []);
        }

        const isEqual = item.key === item.value;
        writer.write(item.key);
        if (!isEqual) {
          writer.write(":").write(item.value);
        }

        writer.write(index === objectStructure.length - 1 ? "" : ",");
      });
    });

    return writer.toString();
  }

  generateEnumStatement(
    statement: Omit<EnumDeclarationStructure, "kind">,
  ): EnumDeclarationStructure {
    return {
      kind: StructureKind.Enum,
      ...statement,
    };
  }

  saveSync(): Array<string> {
    return this.sourceFile.map((node) => {
      node.saveSync();
      return node.getFilePath();
    });
  }
  async save(): Promise<void> {
    const map = this.sourceFile.map((node) => node.save());
    await Promise.allSettled(map);
  }
}
