const fs = require("fs-extra");
const path = require("node:path");

const filePath = path.resolve(
	process.env.CLI_E2E_CONFIG_PATH ??
		path.join(__dirname, ".OpenAPI", "openapi.config.js"),
);
const inputPath = process.env.CLI_E2E_INPUT_PATH ?? "../fixtures/petstore.json";

const config = `const {
  defineConfig,
  pluginTSRequest,
  pluginTSType,
  pluginZod,
} = require('openapi-to')

module.exports = defineConfig({
  servers: [
    {
      name: 'local-json',
      input: {
        path: ${JSON.stringify(inputPath)},
      },
      output: {
        dir: 'server',
        clean: true,
      },
    },
  ],
  plugins: [
    pluginZod(),
    pluginTSType(),
    pluginTSRequest({
      parser: 'zod',
      requestClient: 'common',
      requestImportDeclaration: {
        moduleSpecifier: '../../request',
      },
      requestConfigTypeImportDeclaration: {
        namedImports: ['AxiosRequestConfig'],
        moduleSpecifier: 'axios',
      },
    }),
  ],
})
`;

fs.writeFileSync(filePath, config, { encoding: "utf8" });
