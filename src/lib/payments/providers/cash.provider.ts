import "server-only";
import { PaymentError } from "@/lib/payments/errors";
import { subtractMoney } from "@/lib/utils/money";
import type { PaymentProvider, PaymentRequest, PaymentResult } from "@/lib/payments/types";

/** Cash settles at the drawer, so there is no external gateway to call. */
export class CashProvider implements PaymentProvider {
  readonly id = "cash";
  readonly method = "CASH" as const;
  readonly capabilities = {
    requiresCustomerAction: false,
    supportsStatusQuery: false,
    supportsRefund: true,
    supportsWebhook: false,
  };

  async initiate(request: PaymentRequest): Promise<PaymentResult> {
    const tendered = request.cash?.tenderedAmount ?? request.amount;

    if (tendered + 0.001 < request.amount) {
      throw new PaymentError("Cash tendered is less than the amount due", "INVALID_REQUEST", "CASH");
    }

    return {
      state: "SUCCESSFUL",
      externalRef: null,
      amount: request.amount,
      changeAmount: Math.max(subtractMoney(tendered, request.amount), 0),
      message: "Cash received",
    };
  }

  async refund(): Promise<PaymentResult> {
    return { state: "REVERSED", externalRef: null, amount: 0, message: "Cash refunded from drawer" };
  }
}
