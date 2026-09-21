import type { NextRequest } from "next/server";
import { destroySession, getSession } from "@/lib/auth/session";
import { handleApiError, ok } from "@/lib/api/response";
import { recordAudit, requestContext } from "@/lib/services/audit.service";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    await destroySession();

    if (session) {
      void recordAudit({
        action: "LOGOUT",
        entity: "User",
        entityId: session.user.id,
        userId: session.user.id,
        storeId: session.user.storeId,
        summary: `${session.user.fullName} signed out`,
        ...requestContext(request),
      });
    }

    return ok({ signedOut: true });
  } catch (error) {
    return handleApiError(error);
  }
}
