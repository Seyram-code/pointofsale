import { authorize } from "@/lib/auth/guard";
import { handleApiError, ok } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await authorize();
    return ok(session.user);
  } catch (error) {
    return handleApiError(error);
  }
}
