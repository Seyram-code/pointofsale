import test from "node:test";
import assert from "node:assert/strict";

import { calculateOfflineSaleTotals } from "../src/lib/utils/offline-pos";

test("offline draft totals are derived from quantity and unit price", () => {
  const payload = {
    id: "draft-1",
    customerId: null,
    note: null,
    createdAt: "2026-10-05T10:00:00.000Z",
    items: [
      { productId: "p1", quantity: 2, unitPrice: 12.5 },
      { productId: "p2", quantity: 1, unitPrice: 17.5 },
    ],
  };

  assert.deepEqual(calculateOfflineSaleTotals(payload), {
    subtotal: 42.5,
    itemCount: 3,
    total: 42.5,
  });
});
