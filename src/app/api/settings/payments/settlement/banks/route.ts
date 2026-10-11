import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/response";
import { listPaystackSettlementBanks } from "@/lib/services/paystack-settlement.service";

export async function GET() {
  try {
    await authorize(PERMISSIONS.SETTINGS_VIEW);
    return ok(await listPaystackSettlementBanks());
  } catch (error) {
    return handleApiError(error);
  }
}
