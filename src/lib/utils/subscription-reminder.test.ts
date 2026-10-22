import test from "node:test";
import assert from "node:assert/strict";

import { daysUntilSubscriptionExpiry, isSubscriptionReminderDay } from "./subscription-reminder";

test("subscription reminder day count follows the shop's local calendar date", () => {
  const now = new Date("2026-10-22T23:30:00.000Z");
  const periodEnd = new Date("2026-10-26T00:30:00.000Z");

  assert.equal(daysUntilSubscriptionExpiry(periodEnd, now, "Africa/Accra"), 4);
});

test("subscription reminder dates use the five days before expiry only", () => {
  assert.equal(isSubscriptionReminderDay(5), true);
  assert.equal(isSubscriptionReminderDay(1), true);
  assert.equal(isSubscriptionReminderDay(0), false);
  assert.equal(isSubscriptionReminderDay(6), false);
});
