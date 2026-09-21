import "server-only";
import { paymentDriver } from "@/lib/payments/config";
import { PaymentError } from "@/lib/payments/errors";
import { CashProvider } from "@/lib/payments/providers/cash.provider";
import { LiveMomoProvider, MockMomoProvider } from "@/lib/payments/providers/momo.provider";
import { LiveTerminalProvider, MockTerminalProvider } from "@/lib/payments/providers/terminal.provider";
import { LiveCardProvider, MockCardProvider } from "@/lib/payments/providers/card.provider";
import type { PaymentMethod, PaymentProvider } from "@/lib/payments/types";

/**
 * Single place where a method is bound to an implementation. Flipping
 * PAYMENT_DRIVER=live swaps every gateway-backed method at once; cash is
 * always handled locally.
 */
export function getPaymentProvider(method: PaymentMethod): PaymentProvider {
  const live = paymentDriver() === "live";

  switch (method) {
    case "CASH":
      return new CashProvider();
    case "MOMO":
      return live ? new LiveMomoProvider() : new MockMomoProvider();
    case "CARD_TERMINAL":
      return live ? new LiveTerminalProvider() : new MockTerminalProvider();
    case "CARD":
      return live ? new LiveCardProvider() : new MockCardProvider();
    default:
      throw new PaymentError(`Unsupported payment method: ${method}`, "UNSUPPORTED");
  }
}

export function paymentMethodCapabilities(method: PaymentMethod) {
  return getPaymentProvider(method).capabilities;
}

export function isMockDriver() {
  return paymentDriver() === "mock";
}
