//@ts-nocheck
import { GenerateTSApi } from "../src/GenerateTSApi";
import _ from "lodash";
import openApi3 from "../mock/openApi3.json";
import openApi3Formatter from "../mock/openApi3Formatter.json";
import { tsApiExpected } from "../mock/tsApiExpected";
const generateApi = new GenerateTSApi({}, {}, {});

test("classDoc", () => {
  const doc = generateApi.generatorClassJSDoc(openApi3Formatter.pet);
  const str =
    "/**\n" +
    "           *@tagName pet.\n" +
    "           *@tagDescription pet.\n" +
    "           */";
  return expect(doc).toBe(str);
});

test("functionDoc", () => {
  const apiItem = _.head(openApi3Formatter.pet);
  const doc = generateApi.generatorFuncJSDoc(apiItem);
  const str =
    "\n" +
    "    /**\n" +
    "    *@tagName pet\n" +
    "    *@apiSummary uploads an image \n" +
    "    */";
  return expect(doc).toBe(str);
});
test("run", () => {
  const tagItem = openApi3Formatter.pet;
  const generateApi = new GenerateTSApi({}, openApi3, openApi3Formatter);
  const result = generateApi.run(tagItem);
  return expect(result.codeString).toBe(tsApiExpected);
});
