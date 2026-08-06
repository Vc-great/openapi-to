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
