import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ApiError, handleApiError, ok } from "@/lib/api/response";
import { recordAudit, requestContext } from "@/lib/services/audit.service";
import {
  createPaystackSettlementSubaccount,
  getPaystackSettlementState,
} from "@/lib/services/paystack-settlement.service";

const settlementInput = z.object({
  bankCode: z.string().trim().min(1).max(32),
  accountNumber: z.string().trim().min(5).max(30).regex(/^[0-9]+$/, "Enter a valid account number"),
});

export async function GET() {
  try {
    const session = await authorize(PERMISSIONS.SETTINGS_VIEW);
    return ok(await getPaystackSettlementState(session.user.storeId!));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authorize(PERMISSIONS.SETTINGS_MANAGE);
    const { bankCode, accountNumber } = settlementInput.parse(await request.json());
    const result = await createPaystackSettlementSubaccount(session.user.storeId!, bankCode, accountNumber);

    await recordAudit({
      action: "UPDATE",
      entity: "PaystackSettlement",
      entityId: session.user.storeId,
      userId: session.user.id,
      storeId: session.user.storeId,
      summary: `Connected Paystack settlement to ${result.bankName} account ending ${result.accountLast4}`,
      changes: { status: result.status, bankName: result.bankName, accountLast4: result.accountLast4 },
      ...requestContext(request),
    });

    return ok(result);
  } catch (error) {
    if (error instanceof SyntaxError) return handleApiError(ApiError.badRequest("Invalid request body"));
    return handleApiError(error);
  }
}
