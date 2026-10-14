import assert from "node:assert/strict";
import { test } from "node:test";
import { getPromotionalMonthlyPrice, SUBSCRIPTION_PROMOTION_ENDS_AT } from "@/lib/config/subscription-promotion";

test("subscription promotion prices are applied before the end date", () => {
  const now = new Date("2026-10-14T00:00:00.000Z");
  assert.equal(getPromotionalMonthlyPrice("STARTER", 99, now), 69);
  assert.equal(getPromotionalMonthlyPrice("PREMIUM", 130, now), 99);
  assert.equal(getPromotionalMonthlyPrice("ENTERPRISE", 170, now), 139);
  assert.equal(getPromotionalMonthlyPrice("TRIAL", null, now), null);
});

test("subscription promotion expires at the start of January 1, 2027", () => {
  assert.equal(getPromotionalMonthlyPrice("STARTER", 99, SUBSCRIPTION_PROMOTION_ENDS_AT), null);
});

test("promotion does not increase an already lower regular plan price", () => {
  assert.equal(getPromotionalMonthlyPrice("STARTER", 59, new Date("2026-10-14T00:00:00.000Z")), null);
});
