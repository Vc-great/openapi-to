import {
	StructureKind,
	VariableDeclarationKind,
	type VariableStatementStructure,
} from "ts-morph";

export function buildEnabled(): VariableStatementStructure {
	return {
		leadingTrivia: "\n",
		kind: StructureKind.VariableStatement,
		declarationKind: VariableDeclarationKind.Const,
		docs: [
			{
				description: "Whether to enable handler",
			},
		],
		declarations: [
			{
				name: "enabled",
				type: "",
				initializer: "false",
			},
		],
		isExported: true,
	};
}
