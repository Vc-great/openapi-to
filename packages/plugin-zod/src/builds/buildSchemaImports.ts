import { isEmpty } from "lodash-es";
import { type ImportDeclarationStructure, StructureKind } from "ts-morph";

export function buildSchemaImports(
	refNames: string[],
	moduleSpecifier: string,
) {
	if (isEmpty(refNames)) {
		return [];
	}
	const typeModel: ImportDeclarationStructure = {
		kind: StructureKind.ImportDeclaration,
		namedImports: [...new Set(refNames)].sort(),
		isTypeOnly: false,
		moduleSpecifier,
	};

	return [typeModel];
}
