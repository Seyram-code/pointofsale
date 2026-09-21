import { authorize } from "@/lib/auth/guard";
import { handleApiError, ok } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getPaymentProvider, isMockDriver } from "@/lib/payments/registry";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payments/types";

const METHODS: PaymentMethod[] = ["CASH", "MOMO", "CARD_TERMINAL", "CARD"];

/** Lets the till render only the methods this deployment can actually take. */
export async function GET() {
  try {
    await authorize(PERMISSIONS.POS_ACCESS);

    return ok({
      driver: isMockDriver() ? "mock" : "live",
      methods: METHODS.map((method) => {
        const provider = getPaymentProvider(method);
        return {
          method,
          label: PAYMENT_METHOD_LABELS[method],
          providerId: provider.id,
          capabilities: provider.capabilities,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
