import assert from "node:assert/strict";
import { test } from "node:test";
import { expireUnresolvedPaystackPayment, isSuccessfulPaystackCard, isSuccessfulPaystackMomo, mapPaystackStatus, mapPaystackVerificationStatus, paystackFailureReason } from "@/lib/payments/paystack-status";

test("Paystack failed and cancelled transactions are terminal failures", () => {
  for (const status of ["failed", "cancelled", "canceled"]) {
    assert.equal(mapPaystackStatus(status), "FAILED");
  }
});

test("Paystack success and in-flight statuses are distinguished", () => {
  assert.equal(mapPaystackStatus("success"), "SUCCESSFUL");
  assert.equal(mapPaystackStatus("ongoing"), "PROCESSING");
  assert.equal(mapPaystackStatus("abandoned"), "PROCESSING");
});

test("Paystack verification API errors stay in flight until a transaction status is confirmed", () => {
  assert.equal(mapPaystackVerificationStatus(false, ""), "PROCESSING");
  assert.equal(mapPaystackVerificationStatus(true, "failed"), "FAILED");
  assert.equal(mapPaystackVerificationStatus(true, "abandoned"), "PROCESSING");
  assert.equal(mapPaystackVerificationStatus(true, "success"), "SUCCESSFUL");
});

test("Paystack terminal failures have actionable reasons", () => {
  assert.match(paystackFailureReason("failed") ?? "", /payment failed/);
  assert.equal(paystackFailureReason("abandoned"), undefined);
  assert.equal(paystackFailureReason("ongoing"), undefined);
});

test("verified unresolved Paystack payments expire after one minute", () => {
  const createdAt = new Date("2026-10-14T10:00:00Z");
  const result = { state: "PROCESSING" as const, externalRef: "ref", amount: 10, verified: true };

  assert.equal(expireUnresolvedPaystackPayment(result, createdAt, new Date("2026-10-14T10:00:59Z")).state, "PROCESSING");
  const expired = expireUnresolvedPaystackPayment(result, createdAt, new Date("2026-10-14T10:01:00Z"));
  assert.equal(expired.state, "FAILED");
  assert.match(expired.failureReason ?? "", /Stock was released/);
});

test("unverified or successful Paystack payments do not expire", () => {
  const createdAt = new Date("2026-10-14T10:00:00Z");
  const now = new Date("2026-10-14T10:02:00Z");

  assert.equal(
    expireUnresolvedPaystackPayment({ state: "PROCESSING", externalRef: "ref", amount: 10 }, createdAt, now).state,
    "PROCESSING",
  );
  assert.equal(
    expireUnresolvedPaystackPayment({ state: "SUCCESSFUL", externalRef: "ref", amount: 10, verified: true }, createdAt, now).state,
    "SUCCESSFUL",
  );
});

test("Paystack MoMo requires successful verification, GHS currency, and mobile-money channel", () => {
  assert.equal(isSuccessfulPaystackMomo(true, "success", "mobile_money", "GHS"), true);
  assert.equal(isSuccessfulPaystackMomo(false, "success", "mobile_money", "GHS"), false);
  assert.equal(isSuccessfulPaystackMomo(true, "success", "card", "GHS"), false);
  assert.equal(isSuccessfulPaystackMomo(true, "success", "mobile_money", "USD"), false);
});

test("Paystack card requires successful verification, GHS currency, and card channel", () => {
  assert.equal(isSuccessfulPaystackCard(true, "success", "card", "GHS"), true);
  assert.equal(isSuccessfulPaystackCard(false, "success", "card", "GHS"), false);
  assert.equal(isSuccessfulPaystackCard(true, "success", "mobile_money", "GHS"), false);
  assert.equal(isSuccessfulPaystackCard(true, "success", "card", "USD"), false);
});