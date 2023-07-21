import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  moduleFileExtensions: ["ts", "js", "json", "tsx"],
  extensionsToTreatAsEsm: [".ts"],
  //指示是否应在运行期间报告每个单独的测试。执行后所有错误仍将显示在底部。
  //verbose: true,
  //preset: "ts-jest/presets/default-esm",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testEnvironment: "node",
  transform: {
    "^.+\\.(js|jsx|ts|tsx|mjs)?$": ["ts-jest", { useESM: true }],
  },
  testPathIgnorePatterns: ["./dist"],
  transformIgnorePatterns: [
    "node:http",
    "node_modules/(?!" +
      [
        "node-fetch",
        "fetch-blob",
        "data-uri-to-buffer",
        "jest-runtime",
        "formdata-polyfill",
      ].join("|") +
      ")",
  ],
};

export default config;
