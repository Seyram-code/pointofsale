import { prisma } from "@/lib/db/prisma";
import { ok, fail } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok({ status: "ok", database: "up", timestamp: new Date().toISOString() });
  } catch {
    return fail("INTERNAL_ERROR", "Database unreachable", 503);
  }
}
