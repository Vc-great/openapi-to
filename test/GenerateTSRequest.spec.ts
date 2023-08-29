//@ts-nocheck
import { GenerateTSRequest } from "../src/GenerateTSRequest";
import _ from "lodash";
import openApi3 from "../mock/openApi3.json";
import openApi3Formatter from "../mock/openApi3Formatter.json";
import { tsApiExpected } from "../mock/tsApiExpected";

const generateApi = new GenerateTSRequest({}, {}, {});

test("classDoc", () => {
  const doc = generateApi.generatorClassJSDoc(openApi3Formatter.pet);
  const str = `/**
           *@tagName pet.
           *@tagDescription Everything about your Pets.
           */`;
  return expect(doc).toBe(str);
});

test("functionDoc", () => {
  const apiItem = _.head(openApi3Formatter.pet);
  const doc = generateApi.generatorFuncJSDoc(apiItem);
  const str = `/**
    *@apiSummary uploads an image 
    */`;
  return expect(doc).toBe(str);
});
test("run", () => {
  const tagItem = openApi3Formatter.pet;
  const generateApi = new GenerateTSRequest({}, openApi3, openApi3Formatter);
  const result = generateApi.run(tagItem);
  return expect(result.codeString).toBe(tsApiExpected);
});
