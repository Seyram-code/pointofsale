import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createSubscriptionExpiryReminderMailer } from "@/lib/services/subscription-expiry-reminder.service";
import { daysUntilSubscriptionExpiry, isSubscriptionReminderDay } from "@/lib/utils/subscription-reminder";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_CLAIM_MS = 30 * 60 * 1000;

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
    return NextResponse.json({ success: false, error: "Subscription reminder email is not configured" }, { status: 503 });
  }
  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const subscriptions = await prisma.storeSubscription.findMany({
      where: {
        status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
        canceledAt: null,
        currentPeriodEnd: { gte: now, lte: new Date(now.getTime() + 7 * DAY_MS) },
        store: { isActive: true },
      },
      select: {
        id: true,
        plan: true,
        currentPeriodEnd: true,
        store: {
          select: {
            name: true,
            email: true,
            timezone: true,
            users: {
              where: { role: "ADMIN", status: "ACTIVE", deletedAt: null, email: { not: null } },
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { email: true },
            },
          },
        },
      },
    });

    const reminders: Array<{
      subscription: (typeof subscriptions)[number];
      email: string;
      daysRemaining: number;
      timeZone: string;
    }> = [];
    let missingEmailCount = 0;
    let failed = 0;
    for (const subscription of subscriptions) {
      const timeZone = subscription.store.timezone || "Africa/Accra";
      let daysRemaining: number;
      try {
        daysRemaining = daysUntilSubscriptionExpiry(subscription.currentPeriodEnd, now, timeZone);
      } catch (error) {
        console.error("[subscription-expiry-reminders] invalid shop timezone", {
          subscriptionId: subscription.id,
          timeZone,
          error,
        });
        failed += 1;
        continue;
      }
      if (!isSubscriptionReminderDay(daysRemaining)) continue;

      const email = subscription.store.email?.trim() || subscription.store.users[0]?.email?.trim();
      if (!email) {
        missingEmailCount += 1;
        continue;
      }

      reminders.push({ subscription, email, daysRemaining, timeZone });
    }

    if (reminders.length === 0) {
      return NextResponse.json({
        success: failed === 0,
        ...(failed > 0 ? { error: "Some subscription reminders could not be prepared" } : {}),
        data: { eligible: 0, sent: 0, skipped: 0, missingEmail: missingEmailCount, failed },
      }, { status: failed > 0 ? 500 : 200 });
    }

    const mailer = createSubscriptionExpiryReminderMailer();
    let sent = 0;
    let skipped = 0;

    try {
      for (const reminder of reminders) {
        const { subscription, email, daysRemaining, timeZone } = reminder;
        const identity = {
          subscriptionId: subscription.id,
          periodEnd: subscription.currentPeriodEnd,
          daysBefore: daysRemaining,
        };
        const record = await prisma.subscriptionExpiryReminder.upsert({
          where: {
            subscriptionId_periodEnd_daysBefore: identity,
          },
          create: { ...identity, status: "PENDING" },
          update: {},
          select: { id: true, status: true },
        });

        if (record.status === "SENT") {
          skipped += 1;
          continue;
        }

        const claimed = await prisma.subscriptionExpiryReminder.updateMany({
          where: {
            id: record.id,
            OR: [
              { status: "PENDING" },
              { status: "SENDING", lastAttemptAt: { lte: new Date(now.getTime() - STALE_CLAIM_MS) } },
            ],
          },
          data: { status: "SENDING", lastAttemptAt: now, attempts: { increment: 1 }, lastError: null },
        });
        if (claimed.count === 0) {
          skipped += 1;
          continue;
        }

        try {
          await mailer.send({
            email,
            businessName: subscription.store.name,
            plan: subscription.plan,
            daysRemaining,
            periodEnd: subscription.currentPeriodEnd,
            timeZone,
          });
          await prisma.subscriptionExpiryReminder.update({
            where: { id: record.id },
            data: { status: "SENT", sentAt: new Date(), lastError: null },
          });
          sent += 1;
        } catch (error) {
          await prisma.subscriptionExpiryReminder.update({
            where: { id: record.id },
            data: {
              status: "PENDING",
              lastError: error instanceof Error ? error.message.slice(0, 2000) : "Email delivery failed",
            },
          });
          console.error("[subscription-expiry-reminders] email delivery failed", {
            subscriptionId: subscription.id,
            error,
          });
          failed += 1;
        }
      }
    } finally {
      mailer.close();
    }

    const result = { eligible: reminders.length, sent, skipped, missingEmail: missingEmailCount, failed };
    return NextResponse.json(
      failed > 0
        ? { success: false, error: "Some subscription reminders could not be sent", data: result }
        : { success: true, data: result },
      { status: failed > 0 ? 500 : 200 },
    );
  } catch (error) {
    console.error("[subscription-expiry-reminders] reminder run failed", error);
    return NextResponse.json({ success: false, error: "Subscription reminder run failed" }, { status: 500 });
  }
}
