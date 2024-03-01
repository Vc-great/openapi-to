import type { JSDocTagStructure } from "ts-morph";
import type {
  AmbientableNodeStructure,
  ExportableNodeStructure,
  JSDocableNodeStructure,
  Structure,
} from "ts-morph";
import type {
  BindingNamedNodeStructure,
  ExclamationTokenableNodeStructure,
  KindedStructure,
  OptionalKind,
  StructureKind,
  TypedNodeStructure,
  VariableDeclarationKind,
  WriterFunction,
} from "ts-morph";

export interface VariableStatementStructureOfObject
  extends Structure,
    VariableStatementSpecificStructure,
    JSDocableNodeStructure,
    AmbientableNodeStructure,
    ExportableNodeStructure {}

interface VariableStatementSpecificStructure
  extends KindedStructure<StructureKind.VariableStatement> {
  declarationKind?: VariableDeclarationKind;
  declarations: OptionalKind<VariableDeclarationStructure>[];
}

export interface VariableDeclarationStructure
  extends Structure,
    VariableDeclarationSpecificStructure,
    BindingNamedNodeStructure,
    InitializerExpressionableNodeStructure,
    TypedNodeStructure,
    ExclamationTokenableNodeStructure {}

interface VariableDeclarationSpecificStructure
  extends KindedStructure<StructureKind.VariableDeclaration> {}

export interface InitializerExpressionableNodeStructure {
  initializer?: string | WriterFunction | ObjectStructure[];
}

export interface ObjectStructure {
  key: string;
  value: string;
  docs: JSDocStructure[];
}

export interface JSDocStructure {
  /**
   * The description of the JS doc.
   * @remarks To force this to be multi-line, add a newline to the front of the string.
   */
  description?: string;
  /** JS doc tags (ex. `&#64;param value - Some description.`). */
  tags?: OptionalKind<JSDocTagStructure>[];
}

export type JSDoc = JSDocStructure[];
