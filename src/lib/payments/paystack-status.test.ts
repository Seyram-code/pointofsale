import assert from "node:assert/strict";
import { test } from "node:test";
import { isSuccessfulPaystackCard, isSuccessfulPaystackMomo, mapPaystackStatus, mapPaystackVerificationStatus, paystackFailureReason } from "@/lib/payments/paystack-status";

test("Paystack declined and cancelled transactions are terminal failures", () => {
  for (const status of ["failed", "cancelled", "canceled"]) {
    assert.equal(mapPaystackStatus(status), "FAILED");
  }
  assert.equal(mapPaystackStatus("abandoned"), "PROCESSING");
});

test("Paystack success and in-flight statuses are distinguished", () => {
  assert.equal(mapPaystackStatus("success"), "SUCCESSFUL");
  assert.equal(mapPaystackStatus("ongoing"), "PROCESSING");
});

test("Paystack verification API errors stay in flight until a transaction status is confirmed", () => {
  assert.equal(mapPaystackVerificationStatus(false, ""), "PROCESSING");
  assert.equal(mapPaystackVerificationStatus(true, "failed"), "FAILED");
  assert.equal(mapPaystackVerificationStatus(true, "success"), "SUCCESSFUL");
});

test("Paystack terminal failures have actionable reasons", () => {
  assert.equal(paystackFailureReason("abandoned"), undefined);
  assert.match(paystackFailureReason("failed") ?? "", /payment failed/);
  assert.equal(paystackFailureReason("ongoing"), undefined);
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