//@ts-nocheck
import { GenerateZod } from "../src/GenerateZod";
import openApi3 from "../mock/openApi3.json";
import openApi3Formatter from "../mock/openApi3Formatter.json";
import { zodStringExpected } from "../mock/zodStringExpected";
test("run", () => {
  const generateType = new GenerateZod({}, openApi3, openApi3Formatter);
  const result = generateType.run(openApi3Formatter.pet);
  expect(result.codeString).toBe(zodStringExpected);
});
