import assert from "node:assert/strict";
import { test } from "node:test";
import { calculatePaystackFee, PAYSTACK_FEE_RATE, VIDYPOS_PLATFORM_FEE_RATE } from "@/lib/payments/paystack-fee";
import { addMoney } from "@/lib/utils/money";

test("online payment surcharge covers 2% Paystack and 1% VidyPOS shares", () => {
  const fee = calculatePaystackFee(60);
  const paymentTotal = addMoney(60, fee);
  assert.equal(paymentTotal, 61.86);
  assert.equal(Math.round(paymentTotal * PAYSTACK_FEE_RATE * 100) / 100, 1.24);
  assert.equal(Math.round(paymentTotal * VIDYPOS_PLATFORM_FEE_RATE * 100) / 100, 0.62);
  assert.equal(addMoney(paymentTotal, -1.24, -0.62), 60);
  assert.equal(addMoney(12.34, calculatePaystackFee(12.34)), 12.72);
  assert.equal(calculatePaystackFee(0), 0);
});
