import test from "node:test";
import assert from "node:assert/strict";

import { calculateExpectedShiftCash } from "./shift";

test("expected shift cash includes the opening float and net cash sales", () => {
  assert.equal(calculateExpectedShiftCash(500, 200), 700);
});

test("expected shift cash accounts for cash refunds included in net cash sales", () => {
  assert.equal(calculateExpectedShiftCash(500, 200 - 30), 670);
});
