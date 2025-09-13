import type { RequiredPluginConfig } from "../types.ts";

export const hasPlaceholderData = (
	placeholderData: RequiredPluginConfig["placeholderData"],
	path: string,
) => {
	return placeholderData.pathInclude.some((item: RegExp | string) => {
		if (typeof item === "string") {
			return path.includes(item);
		}
		return item.test(path);
	});
};
