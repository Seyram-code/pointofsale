import test from "node:test";
import assert from "node:assert/strict";

import { checkPasswordStrength } from "./password";

test("common strong passwords without symbols are accepted", () => {
  const result = checkPasswordStrength("Password123");

  assert.equal(result.valid, true);
  assert.deepEqual(result.issues, []);
});
