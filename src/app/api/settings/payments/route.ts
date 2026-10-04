import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { handleApiError, ok, ApiError } from "@/lib/api/response";
import { isPaystackEnabled, setPaystackEnabled } from "@/lib/services/payment-settings.service";

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
    const enabled = await setPaystackEnabled(session.user.storeId, body.paystackEnabled);
    return ok({ paystackEnabled: enabled });
  } catch (error) {
    return handleApiError(error);
  }
}