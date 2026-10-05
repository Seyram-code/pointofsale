import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { reconcileStalePayments } from "@/lib/services/checkout.service";

export const dynamic = "force-dynamic";

function hasValidCronSecret(request: Request, secret: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const providedBuffer = Buffer.from(provided);
  const secretBuffer = Buffer.from(secret);
  return providedBuffer.length === secretBuffer.length && timingSafeEqual(providedBuffer, secretBuffer);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, error: "Payment reconciliation is not configured" }, { status: 503 });
  }
  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reconcileStalePayments({
      olderThan: new Date(Date.now() - 2 * 60_000),
      limit: 50,
    });
    return NextResponse.json({ success: true, data: result });
  } catch {
    return NextResponse.json({ success: false, error: "Payment reconciliation failed" }, { status: 500 });
  }
}