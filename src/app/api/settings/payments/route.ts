import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { handleApiError, ok, ApiError } from "@/lib/api/response";
import { isPaystackEnabled, setPaystackEnabled } from "@/lib/services/payment-settings.service";
import { getPaystackSettlementRouting } from "@/lib/services/paystack-settlement.service";

export async function GET() {
  try {
    const session = await authorize(PERMISSIONS.SETTINGS_VIEW);
    const enabled = await isPaystackEnabled(session.user.storeId!);
    return ok({ paystackEnabled: enabled });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await authorize(PERMISSIONS.SETTINGS_MANAGE);
    const body = z.object({ paystackEnabled: z.boolean() }).parse(await request.json());
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store");
    if (body.paystackEnabled) {
      const settlement = await getPaystackSettlementRouting(session.user.storeId);
      if (!settlement.subaccountCode) {
        throw ApiError.badRequest("Connect a verified settlement account before enabling Paystack payments.");
      }
    }
    const enabled = await setPaystackEnabled(session.user.storeId, body.paystackEnabled);
    return ok({ paystackEnabled: enabled });
  } catch (error) {
    return handleApiError(error);
  }
}