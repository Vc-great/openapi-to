import type { OperationWrapper } from "@openapi-to/core";
import { URLPath } from "@openapi-to/core/utils";
import type { RequiredPluginConfig } from "../types.ts";

/**
 * 构建请求方法体
 * @param operation - 操作包装器
 * @param pluginConfig - 插件配置
 * @returns 生成的请求方法体字符串
 */
export function buildMethodBody(
	operation: OperationWrapper,
	pluginConfig: RequiredPluginConfig,
): string {
	const url = new URLPath(operation.path);
	return `return http.get(
    '${url.toURLPath}',
    (info) => {
      return HttpResponse.json(data, {
        status: 200,
      });
    },
  )`;
}
