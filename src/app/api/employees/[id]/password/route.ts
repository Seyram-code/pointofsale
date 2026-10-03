import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ApiError, handleApiError } from "@/lib/api/response";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authorize(PERMISSIONS.EMPLOYEES_MANAGE);
    await params;
    throw ApiError.badRequest("Employees sign in with staff access codes. Use the access-code reset action instead.");
  } catch (error) {
    return handleApiError(error);
  }
}