import assert from "node:assert/strict";
import { test } from "node:test";
import { mapPaystackStatus } from "@/lib/payments/paystack-status";

test("Paystack declined and abandoned transactions are terminal failures", () => {
  for (const status of ["failed", "abandoned", "cancelled", "canceled"]) {
    assert.equal(mapPaystackStatus(status), "FAILED");
  }
});

test("Paystack success and in-flight statuses are distinguished", () => {
  assert.equal(mapPaystackStatus("success"), "SUCCESSFUL");
  assert.equal(mapPaystackStatus("ongoing"), "PROCESSING");
});