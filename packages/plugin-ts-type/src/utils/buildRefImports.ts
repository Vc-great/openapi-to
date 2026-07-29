import path from "node:path";
import {
	formatterModuleSpecifier,
	getRelativePath,
} from "@openapi-to/core/utils";
import type { ImportDeclarationStructure } from "ts-morph";
import { buildTypeImports } from "@/builds/buildTypeImports.ts";
import { getRefFilePath } from "@/utils/getRefFilePath.ts";
import { getUpperFirstRefAlias } from "@/utils/getUpperFirstRefAlias.ts";

export function buildRefImports(
	refs: readonly string[],
	filePath: string,
	componentFolderPath: string,
	importWithExtension: boolean | undefined,
): ImportDeclarationStructure[] {
	const importsByPath = new Map<string, Set<string>>();
	for (const ref of refs) {
		const targetPath = getRefFilePath(ref, componentFolderPath);
		if (!targetPath || path.resolve(targetPath) === path.resolve(filePath)) {
			continue;
		}
		const names = importsByPath.get(targetPath) ?? new Set<string>();
		names.add(getUpperFirstRefAlias(ref));
		importsByPath.set(targetPath, names);
	}

	return [...importsByPath.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.flatMap(([targetPath, names]) =>
			buildTypeImports(
				[...names].sort(),
				formatterModuleSpecifier(
					getRelativePath(filePath, targetPath),
					importWithExtension,
				),
			),
		);
}
