//@ts-nocheck
import { GenerateTSRequest } from "../src/GenerateTSRequest";
import _ from "lodash";
import openApi3 from "../mock/openApi3.json";
import openApi3Formatter from "../mock/openApi3Formatter.json";
import { tsApiExpected } from "../mock/tsApiExpected";
import { tsResquestZodDecoratorExpected } from "../mock/tsResquestZodDecoratorExpected";

const generateApi = new GenerateTSRequest({}, {}, {});

test("run zodDecorator true", () => {
  const tagItem = openApi3Formatter.pet;
  const generateApi = new GenerateTSRequest(
    { zodDecorator: true },
    openApi3,
    openApi3Formatter
  );
  const result = generateApi.run(tagItem);
  return expect(result.codeString).toBe(tsResquestZodDecoratorExpected);
});

test("run zodDecorator false", () => {
  const tagItem = openApi3Formatter.pet;
  const generateApi = new GenerateTSRequest(
    { zodDecorator: false },
    openApi3,
    openApi3Formatter
  );
  const result = generateApi.run(tagItem);
  return expect(result.codeString).toBe(tsApiExpected);
});
