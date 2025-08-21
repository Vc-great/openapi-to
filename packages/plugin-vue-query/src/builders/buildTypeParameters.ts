import type { OperationWrapper } from "@openapi-to/core";
import { OpenAPIV3 } from "openapi-types";
import {
	type OptionalKind,
	type TypeParameterDeclarationStructure,
	TypeParameterVariance,
} from "ts-morph";

export function buildTypeParameters(
	operation: OperationWrapper,
): OptionalKind<TypeParameterDeclarationStructure>[] {
	const isGet = operation.method === OpenAPIV3.HttpMethods.GET;

	return isGet
		? []
		: [{ name: "TContext", variance: TypeParameterVariance.None }];
}
