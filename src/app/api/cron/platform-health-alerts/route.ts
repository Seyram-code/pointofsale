import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { notifySuperAdmins, sendSuperAdminAlert } from "@/lib/services/super-admin-alerts.service";
import { getPlatformHealthNotices } from "@/lib/services/platform.service";

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
    return NextResponse.json({ success: false, error: "Platform health alerting is not configured" }, { status: 503 });
  }
  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const notices = await getPlatformHealthNotices();
    const activeKeys = notices.map((notice) => notice.id);
    const previouslyActive = await prisma.platformHealthSignal.findMany({
      where: { isActive: true },
      select: { signalKey: true, title: true },
    });
    const previousKeys = new Set(previouslyActive.map((signal) => signal.signalKey));

    for (const notice of notices) {
      await prisma.platformHealthSignal.upsert({
        where: { signalKey: notice.id },
        create: {
          signalKey: notice.id,
          title: notice.title,
          body: notice.body,
          severity: notice.severity,
          isActive: true,
          firstSeenAt: now,
          lastSeenAt: now,
        },
        update: {
          title: notice.title,
          body: notice.body,
          severity: notice.severity,
          isActive: true,
          lastSeenAt: now,
          lastNotifiedAt: previousKeys.has(notice.id) ? undefined : null,
          resolvedAt: null,
        },
      });
    }

    await prisma.platformHealthSignal.updateMany({
      where: { isActive: true, ...(activeKeys.length ? { signalKey: { notIn: activeKeys } } : {}) },
      data: { isActive: false, resolvedAt: now },
    });

    const unnotifiedExisting = await prisma.platformHealthSignal.findMany({
      where: { isActive: true, lastNotifiedAt: null },
      select: { signalKey: true, title: true, body: true, severity: true },
    });
    const alerts = unnotifiedExisting.map((signal) => ({
      id: signal.signalKey,
      title: signal.title,
      body: signal.body,
      severity: signal.severity,
    }));

    if (alerts.length > 0) {
      try {
        await sendSuperAdminAlert({
          subject: `VidyPOS platform health: ${alerts.length} new signal${alerts.length === 1 ? "" : "s"}`,
          text: alerts.map((notice) => `${notice.severity.toUpperCase()}: ${notice.title}\n${notice.body}`).join("\n\n"),
          details: alerts.map((notice) => ({ label: notice.severity.toUpperCase(), value: `${notice.title}: ${notice.body}` })),
        });
        await prisma.platformHealthSignal.updateMany({
          where: { signalKey: { in: alerts.map((notice) => notice.id) }, isActive: true },
          data: { lastNotifiedAt: now },
        });
      } catch (error) {
        console.error("[platform-health-alerts] failed to email health signals", error);
        throw error;
      }
    }

    const recovered = previouslyActive.filter((signal) => !activeKeys.includes(signal.signalKey));
    if (recovered.length > 0) {
      await notifySuperAdmins({
        subject: `VidyPOS platform health: ${recovered.length} signal${recovered.length === 1 ? "" : "s"} recovered`,
        text: "The following platform health signals are no longer active.",
        details: recovered.map((signal) => ({ label: "Recovered", value: signal.title })),
      });
    }

    return NextResponse.json({ success: true, data: { activeSignals: notices.length, newSignals: alerts.length, recoveredSignals: recovered.length } });
  } catch {
    return NextResponse.json({ success: false, error: "Platform health alert check failed" }, { status: 500 });
  }
}
