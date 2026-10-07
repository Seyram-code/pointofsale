import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldAttemptProviderRefund } from "@/lib/payments/refund-gating";
import type { PaymentProvider } from "@/lib/payments/types";

test("store-credit and unsupported provider refunds are skipped", () => {
  const supportsRefund = { requiresCustomerAction: false, supportsStatusQuery: false, supportsRefund: true, supportsWebhook: false };
  const providerWithoutRefund = { capabilities: supportsRefund } as unknown as Pick<PaymentProvider, "capabilities" | "refund">;
  const providerWithRefund: Pick<PaymentProvider, "capabilities" | "refund"> = {
    capabilities: supportsRefund,
    refund: async () => ({ state: "REVERSED", externalRef: null, amount: 0 }),
  };

  assert.equal(shouldAttemptProviderRefund("STORE_CREDIT", providerWithRefund), false);
  assert.equal(shouldAttemptProviderRefund("EXCHANGE", providerWithRefund), false);
  assert.equal(
    shouldAttemptProviderRefund("CARD", providerWithoutRefund),
    false,
  );
  assert.equal(shouldAttemptProviderRefund("CARD", providerWithRefund), true);
});
