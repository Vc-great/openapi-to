import * as assert from "assert";
import { sum } from "../src/sum";
describe("validate:", () => {
  describe("myFirstFunc", () => {
    test(" add function ", () => {
      assert.strictEqual(sum(1, 2), 3);
    });
  });
});
