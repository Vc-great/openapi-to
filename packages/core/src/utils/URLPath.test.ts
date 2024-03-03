import { expect } from "vitest";

import { URLPath } from "./URLPath.ts";

describe("URLPath", () => {
  const path = new URLPath(
    "/user/{userID}/monetary-account/{monetary-accountID}/whitelist-sdd/{itemId}",
  );

  test("if object is getting returned", () => {
    expect(path.requestPath).toBe(
      "`/user/${userId}/monetary-account/${monetaryAccountId}/whitelist-sdd/${itemId}`",
    );
  });
});
