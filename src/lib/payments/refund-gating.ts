import type { PaymentMethod, PaymentProvider } from "@/lib/payments/types";

export function shouldAttemptProviderRefund(
  method: PaymentMethod | "CARD_REVERSAL" | "STORE_CREDIT" | "EXCHANGE" | undefined,
  provider?: Pick<PaymentProvider, "capabilities" | "refund">,
): boolean {
  if (!method || !provider) return false;
  if (method === "STORE_CREDIT" || method === "EXCHANGE") return false;
  if (!provider.capabilities?.supportsRefund) return false;
  if (typeof provider.refund !== "function") return false;
  return true;
}