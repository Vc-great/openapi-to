//@ts-nocheck
import path from "node:path";
import { pluginEnum } from "@openapi-to/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildEnabled } from "./builds/buildEnabled.ts";
import { buildImports } from "./builds/buildImports.ts";
import { buildMethodBody } from "./builds/buildMethodBody.ts";
import { buildMethodParameters } from "./builds/buildMethodParameters.ts";
import { definePlugin } from "./plugin";
import { jsDocTemplateFromMethod } from "./template/jsDocTemplateFromMethod.ts";

// 模拟依赖
const mockAddFunction = vi.fn();
const mockAddStatements = vi.fn();
const mockCreateSourceFile = vi.fn(() => ({
	addFunction: mockAddFunction,
	addStatements: mockAddStatements,
}));

vi.mock("ts-morph", () => {
	return {
		Project: vi.fn(() => ({
			createSourceFile: mockCreateSourceFile,
		})),
		StructureKind: {
			Function: "Function",
			ImportDeclaration: "ImportDeclaration",
		},
	};
});

vi.mock("./builds/buildImports.ts", () => ({
	buildImports: vi.fn(() => []),
}));

vi.mock("./builds/buildMethodBody.ts", () => ({
	buildMethodBody: vi.fn(() => "return fetch();"),
}));

vi.mock("./builds/buildMethodParameters.ts", () => ({
	buildMethodParameters: vi.fn(() => []),
}));

vi.mock("./builds/buildEnabled.ts", () => ({
	buildEnabled: vi.fn(() => "export const enabled = false;"),
}));

vi.mock("./template/jsDocTemplateFromMethod.ts", () => ({
	jsDocTemplateFromMethod: vi.fn(() => [{ description: "测试文档" }]),
}));

vi.mock("@openapi-to/core/utils", () => ({
	getRelativePath: vi.fn(() => "../types"),
	formatterModuleSpecifier: vi.fn(
		(specifier, withExt) => specifier + (withExt ? ".ts" : ""),
	),
}));

vi.mock("lodash-es", () => ({
	kebabCase: vi.fn((str) => {
		// 正确实现 kebabCase：将驼峰命名转换为 kebab-case
		return str
			.replace(/([a-z])([A-Z])/g, "$1-$2")
			.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
			.toLowerCase();
	}),
}));

describe("definePlugin", () => {
	type MockOperation = {
		tagName: string;
		accessor: {
			operationName: string;
			setOperationRequest: ReturnType<typeof vi.fn>;
		};
	};

	type MockContext = {
		openapiToSingleConfig: {
			output: {
				dir: string;
			};
		};
		setSourceFiles: ReturnType<typeof vi.fn>;
		logger: {
			info: ReturnType<typeof vi.fn>;
		};
	};

	type MockTagData = {
		name: string;
		formattedTagName: string;
		description: string;
	};

	let mockOperation: MockOperation;
	let mockContext: MockContext;
	let mockTagData: MockTagData;

	beforeEach(() => {
		// 重置所有模拟
		vi.clearAllMocks();

		// 准备测试数据
		mockOperation = {
			tagName: "testTag",
			accessor: {
				operationName: "testOperation",
				setOperationRequest: vi.fn(),
			},
		};

		mockContext = {
			openapiToSingleConfig: {
				output: {
					dir: "/output",
				},
			},
			setSourceFiles: vi.fn(),
			logger: {
				info: vi.fn(),
			},
		};

		mockTagData = {
			name: "testTag",
			formattedTagName: "TestTag",
			description: "测试标签描述",
		};
	});

	it("应该创建具有正确属性的插件", () => {
		const plugin = definePlugin({});

		expect(plugin.name).toBe(pluginEnum.MSW);
		expect(plugin.dependencies).toContain(pluginEnum.TsType);
	});

	it("当配置 responseDefaultType 为 faker 时应不包含其他依赖", () => {
		const plugin = definePlugin({ responseDefaultType: "faker" });

		expect(plugin.dependencies).toEqual([pluginEnum.TsType]);
	});

	it("应正确处理 buildStart 钩子", async () => {
		const plugin = definePlugin({});
		await plugin.hooks.buildStart(mockContext);

		// 这里暂时没有多少逻辑可测试，但确保钩子能正常执行
		expect(true).toBeTruthy();
	});

	it("应正确处理 tagStart 钩子", async () => {
		const plugin = definePlugin({});
		await plugin.hooks.tagStart(mockTagData, mockContext);

		// 验证钩子可以正常执行
		expect(true).toBeTruthy();
	});

	it("应正确处理 operation 钩子", async () => {
		const plugin = definePlugin({});

		await plugin.hooks.operation(mockOperation, mockContext);

		// 验证是否设置了操作请求信息 - MSW 生成 handler 文件
		expect(mockOperation.accessor.setOperationRequest).toHaveBeenCalledWith({
			filePath: path.join("/output", "test-tag", "test-operation.handler.ts"),
			requestName: "testOperationHandler",
		});

		// 验证是否创建了源文件
		expect(mockCreateSourceFile).toHaveBeenCalled();
		expect(mockCreateSourceFile).toHaveBeenCalledWith(
			path.join("/output", "test-tag", "test-operation.handler.ts"),
			"",
			{ overwrite: true },
		);

		// 验证是否添加了导入语句
		expect(mockAddStatements).toHaveBeenCalledWith([]);

		// 验证是否添加了 enabled 语句
		expect(mockAddStatements).toHaveBeenCalledWith([
			"export const enabled = false;",
		]);

		// 验证是否调用了必要的生成函数
		expect(buildImports).toHaveBeenCalledWith(
			mockOperation,
			{
				importWithExtension: true,
				responseDefaultType: "",
			},
			path.join("/output", "test-tag", "test-operation.handler.ts"),
		);
		expect(buildMethodParameters).toHaveBeenCalledWith(mockOperation, {
			importWithExtension: true,
			responseDefaultType: "",
		});
		expect(buildMethodBody).toHaveBeenCalledWith(mockOperation, {
			importWithExtension: true,
			responseDefaultType: "",
		});
		expect(jsDocTemplateFromMethod).toHaveBeenCalledWith(mockOperation);

		// 验证是否添加了函数
		expect(mockAddFunction).toHaveBeenCalledWith({
			kind: "Function",
			isAsync: false,
			name: "testOperationHandler",
			parameters: [],
			returnType: undefined,
			isDefaultExport: true,
			docs: [{ description: "测试文档" }],
			statements: "return fetch();",
		});

		// 验证是否设置了源文件
		expect(mockContext.setSourceFiles).toHaveBeenCalledWith(
			[pluginEnum.MSW, "testOperation"],
			expect.anything(),
		);
	});

	it("应正确处理配置选项", async () => {
		const plugin = definePlugin({
			importWithExtension: false,
			responseDefaultType: "faker",
		});

		await plugin.hooks.operation(mockOperation, mockContext);

		// 验证配置传递
		expect(buildMethodParameters).toHaveBeenCalledWith(mockOperation, {
			importWithExtension: false,
			responseDefaultType: "faker",
		});
		expect(buildMethodBody).toHaveBeenCalledWith(mockOperation, {
			importWithExtension: false,
			responseDefaultType: "faker",
		});
	});

	it("应正确处理 tagEnd 钩子", async () => {
		const plugin = definePlugin({});
		await plugin.hooks.tagEnd(mockTagData, mockContext);

		// 当前这个钩子主要包含注释掉的代码，确保能正常执行即可
		expect(true).toBeTruthy();
	});
});
