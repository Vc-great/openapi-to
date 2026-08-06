import { createHash } from "node:crypto";
import { upperFirst } from "lodash-es";

function identifierSegment(value: string | undefined): string {
	return upperFirst(value ?? "")
		.replace(/_u(?=[0-9a-f]+_)/g, "_u5f_u")
		.replace(
			/([^A-Za-z0-9_$])([A-Za-z0-9]?)/g,
			(_match, character: string, next: string) =>
				`_u${character.codePointAt(0)?.toString(16)}_${next.toUpperCase()}`,
		);
}

export function getInlineSchemaContextName(
	parentName: string | undefined,
	propertyName: string,
): string {
	return `${identifierSegment(parentName)}${identifierSegment(propertyName)}`;
}

export function getInlineEnumTypeName(
	parentName: string | undefined,
	propertyName: string,
): string {
	return `${getInlineSchemaContextName(parentName, propertyName)}EnumValue`;
}

export type InlineEnumSourcePath = readonly (number | string)[];

export interface InlineEnumSource {
	name: string;
	sourcePath: InlineEnumSourcePath;
}

export interface InlineEnumSymbolResolver {
	getTypeName(
		sourcePath: InlineEnumSourcePath,
		legacyTypeName: string,
	): string;
}

interface AllocatedSymbol {
	name: string;
	sourcePath: InlineEnumSourcePath;
	typeName: string;
}

/**
 * Keeps legacy readable names for singleton candidates and gives every member
 * of a collision group a path-derived suffix. The complete source path is the
 * shared identity for declaration collection and recursive reference rendering.
 */
export class InlineEnumSymbolAllocator<T extends InlineEnumSource> {
	private readonly allocatedItems = new Map<string, AllocatedSymbol>();

	constructor(sources: readonly T[]) {
		const groups = new Map<string, T[]>();
		for (const source of sources) {
			const legacyTypeName = legacyTypeNameForSource(source);
			const group = groups.get(legacyTypeName) ?? [];
			group.push(source);
			groups.set(legacyTypeName, group);
		}

		const finalSymbols = new Map<string, AllocatedSymbol>();
		for (const [legacyTypeName, group] of [...groups].sort(([left], [right]) =>
			left < right ? -1 : left > right ? 1 : 0,
		)) {
			const distinctPaths = [
				...new Set(group.map(({ sourcePath }) => sourcePathKey(sourcePath))),
			].sort();
			const hasCollision = distinctPaths.length > 1;

			for (const source of group) {
				const name = hasCollision
					? `${upperFirst(source.name)}__${sourcePathHash(source.sourcePath)}`
					: source.name;
				const typeName = `${upperFirst(name)}EnumValue`;
				assertValidTypeScriptIdentifier(typeName, source.sourcePath);

				const allocated = { name, sourcePath: source.sourcePath, typeName };
				const existingFinalSymbol = finalSymbols.get(typeName);
				if (
					existingFinalSymbol &&
					sourcePathKey(existingFinalSymbol.sourcePath) !==
						sourcePathKey(source.sourcePath)
				) {
					throw symbolCollisionError(
						typeName,
						existingFinalSymbol.sourcePath,
						source.sourcePath,
					);
				}
				finalSymbols.set(typeName, allocated);

				const sourceKey = sourcePathKey(source.sourcePath);
				const existingSourceSymbol = this.allocatedItems.get(sourceKey);
				if (
					existingSourceSymbol &&
					existingSourceSymbol.typeName !== typeName
				) {
					throw symbolCollisionError(
						legacyTypeName,
						existingSourceSymbol.sourcePath,
						source.sourcePath,
					);
				}
				this.allocatedItems.set(sourceKey, allocated);
			}
		}
	}

	getEnumItem(source: T): T {
		const allocated = this.allocatedItems.get(
			sourcePathKey(source.sourcePath),
		);
		if (!allocated) {
			throw new Error(
				`Inline enum source was not allocated: ${formatSourcePath(source.sourcePath)}`,
			);
		}
		return { ...source, name: allocated.name };
	}

	getTypeName(
		sourcePath: InlineEnumSourcePath,
		legacyTypeName: string,
	): string {
		const allocated = this.allocatedItems.get(
			sourcePathKey(sourcePath),
		);
		if (!allocated) {
			throw new Error(
				`Inline enum symbol was not allocated for ${legacyTypeName} at ${formatSourcePath(sourcePath)}.`,
			);
		}
		return allocated.typeName;
	}
}

export function formatSourcePath(sourcePath: InlineEnumSourcePath): string {
	const pointer = sourcePath
		.map((segment) =>
			String(segment).replaceAll("~", "~0").replaceAll("/", "~1"),
		)
		.join("/");
	const formatted = `#/${pointer}`;
	if (formatted.length <= 512) return formatted;
	return `${formatted.slice(0, 488)}...<sha256:${sourcePathHash(sourcePath)}>`;
}

function legacyTypeNameForSource(source: InlineEnumSource): string {
	return `${upperFirst(source.name)}EnumValue`;
}

function sourcePathKey(sourcePath: InlineEnumSourcePath): string {
	return JSON.stringify(sourcePath);
}

function sourcePathHash(sourcePath: InlineEnumSourcePath): string {
	return createHash("sha256")
		.update(sourcePathKey(sourcePath))
		.digest("hex")
		.slice(0, 12);
}

function assertValidTypeScriptIdentifier(
	typeName: string,
	sourcePath: InlineEnumSourcePath,
): void {
	if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(typeName)) {
		throw new Error(
			`Invalid inline enum symbol ${typeName} for ${formatSourcePath(sourcePath)}.`,
		);
	}
}

function symbolCollisionError(
	symbol: string,
	firstSourcePath: InlineEnumSourcePath,
	secondSourcePath: InlineEnumSourcePath,
): Error {
	return new Error(
		`Inline enum symbol collision for ${symbol}: ${formatSourcePath(firstSourcePath)} and ${formatSourcePath(secondSourcePath)}.`,
	);
}
