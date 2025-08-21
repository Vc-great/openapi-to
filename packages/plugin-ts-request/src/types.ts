export enum RequestClientEnum {
	AXIOS = "axios",
	COMMON = "common",
}

export type RequestClient = "axios" | "common";

export type RequiredPluginConfig = Required<Omit<PluginConfig, "parser">> & {
	parser?: "zod";
};

export type PluginConfig = {
	requestImportDeclaration?: {
		moduleSpecifier: string;
	};
	requestConfigTypeImportDeclaration?: {
		namedImports: Array<string>;
		moduleSpecifier: string;
	};
	requestClient?: RequestClient;
	parser?: "zod";
	/**
	 * 是否在 import 路径中添加扩展名（如 .ts）
	 */
	importWithExtension?: boolean;
	/**
	 * ReturnType that will be used when calling the client.Use dataReturnType only in get method
	 */
	dataReturnType?: string;
};

export type OperationTypeOfTag = {
	namedImports: string[];
	moduleSpecifier: string;
};
