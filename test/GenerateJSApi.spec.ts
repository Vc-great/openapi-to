//@ts-nocheck
import { GenerateJSApi } from "../src/GenerateJSApi";
import openApi3 from "../mock/openApi3.json";
import openApi3Formatter from "../mock/openApi3Formatter.json";
import { jsApiExpected } from "../mock/jsApiExpected";

const generateApi = new GenerateJSApi({}, {}, {});

test("run", () => {
  const tagItem = openApi3Formatter.pet;
  const generateApi = new GenerateJSApi({}, openApi3, openApi3Formatter);
  const result = generateApi.run(tagItem);
  expect(result.codeString).toBe(jsApiExpected);
});
