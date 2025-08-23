export type RequiredPluginConfig = Required<PluginConfig>;

export type PluginConfig = {
	/**
	 * 是否在 import 路径中添加扩展名（如 .ts）
	 */
	importWithExtension?: boolean;
	/**
	 * 默认的响应类型 faker
	 */
	responseDefaultType?: string;
};
