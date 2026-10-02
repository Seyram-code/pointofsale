import { authorize } from "@/lib/auth/guard";
import { handleApiError, ok } from "@/lib/api/response";

export async function GET() {
  try {
    // Session probes must succeed for an expired shop so the client keeps the user on
    // `/subscription` instead of treating it as a signed-out session.
    const session = await authorize(undefined, { allowExpiredSubscription: true });
    return ok(session.user);
  } catch (error) {
    return handleApiError(error);
  }
}
