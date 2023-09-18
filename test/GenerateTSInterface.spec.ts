//@ts-nocheck
import { GenerateTSInterface } from "../src/GenerateTSInterface";
import openApi3 from "../mock/openApi3.json";
import openApi3Formatter from "../mock/openApi3Formatter.json";
import { tsInterfaceStringExpected } from "../mock/tsInterfaceStringExpected";
test("run", () => {
  const generateType = new GenerateTSInterface({}, openApi3, openApi3Formatter);
  const result = generateType.run(openApi3Formatter.pet);
  return expect(result.codeString).toBe(tsInterfaceStringExpected);
});
