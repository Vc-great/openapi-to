//@ts-nocheck
import { GenerateRequestObject } from "../src/GenerateRequestObject";
import openApi3 from "../mock/openApi3.json";
import openApi3Formatter from "../mock/openApi3Formatter.json";
import { requestObjectExpected } from "../mock/requestObject";
test("run", () => {
  const genetateRequestObject = new GenerateRequestObject(
    {},
    openApi3,
    openApi3Formatter
  );
  const result = genetateRequestObject.run(openApi3Formatter.pet);
  expect(result.codeString).toBe(requestObjectExpected);
});
