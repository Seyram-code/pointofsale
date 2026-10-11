import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { ApiError, created, handleApiError } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { checkout } from "@/lib/services/checkout.service";
import { checkoutSchema } from "@/lib/validations/sale.schema";
import { recordAudit, requestContext } from "@/lib/services/audit.service";
import { isPaystackEnabled } from "@/lib/services/payment-settings.service";
import { isLivePaystackMethod, isPaystackMethod } from "@/lib/payments/config";
import { getAppUrl } from "@/lib/config/app-url";
import { getPaystackSettlementRouting } from "@/lib/services/paystack-settlement.service";

export async function POST(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.POS_SELL);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");

    const input = checkoutSchema.parse(await request.json());
    const usesPaystack = input.payments.some((payment) => (payment.method === "CARD" || payment.method === "MOMO") && isPaystackMethod(payment.method));
    const usesLivePaystack = input.payments.some((payment) => (payment.method === "CARD" || payment.method === "MOMO") && isLivePaystackMethod(payment.method));
    let settlementSubaccountCode: string | undefined;
    if (usesPaystack) {
      if (!(await isPaystackEnabled(session.user.storeId))) {
        throw ApiError.badRequest("Paystack payments are disabled for this shop. Choose another payment method.");
      }
    }
    if (usesLivePaystack) {
      const settlement = await getPaystackSettlementRouting(session.user.storeId);
      if (!settlement.subaccountCode) {
        throw ApiError.badRequest("Connect a verified Paystack settlement account in Settings before accepting online card or Mobile Money payments.");
      }
      settlementSubaccountCode = settlement.subaccountCode;
    }

    if (input.discount && !session.user.permissions.includes(PERMISSIONS.POS_DISCOUNT_APPLY)) {
      throw new ApiError("FORBIDDEN", "You are not allowed to apply discounts", 403);
    }

    const result = await checkout(input, {
      storeId: session.user.storeId,
      cashierId: session.user.id,
      allowPriceOverride: session.user.permissions.includes(PERMISSIONS.POS_PRICE_OVERRIDE),
      businessType: session.user.businessType ?? undefined,
      appUrl: getAppUrl(),
      settlementSubaccountCode,
    });

    await recordAudit({
      action: "CREATE",
      entity: "Sale",
      entityId: result.saleId,
      userId: session.user.id,
      storeId: session.user.storeId,
      summary:
        result.status === "COMPLETED"
          ? `Completed sale ${result.receiptNumber} totalling GHS ${result.total.toFixed(2)}`
          : `Checkout ${result.status.toLowerCase()} for ${result.receiptNumber}`,
      changes: { methods: result.payments.map((payment) => payment.method) },
      ...requestContext(request),
    });

    return created(result);
  } catch (error) {
    return handleApiError(error);
  }
}
