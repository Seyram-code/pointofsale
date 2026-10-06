import type { Metadata } from "next";
import { CalendarDays, CreditCard, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { AppShell } from "@/components/layout/AppShell";
import { SubscriptionManager } from "@/components/subscription/SubscriptionManager";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlatformFeatureChecklist } from "@/components/platform/PlatformFeatureChecklist";
import { getPlatformPlanPricing } from "@/lib/services/plan-pricing.service";
import { getSubscriptionPlan, normalizePlanKey, SELECTABLE_PLAN_KEYS, type SubscriptionPlan } from "@/lib/config/subscription-plans";

export const metadata: Metadata = { title: "Subscription", robots: { index: false, follow: false, noarchive: true } };
export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const session = await requireSession("/subscription");
  if (session.user.isEmployee || session.user.role === "SUPER_ADMIN") redirect("/forbidden");
  if (!session.user.storeId) redirect("/forbidden");
  const [subscription, account] = await Promise.all([
    prisma.storeSubscription.findFirst({ where: { storeId: session.user.storeId }, orderBy: { createdAt: "desc" }, include: { store: { select: { phone: true } } } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } }),
  ]);
  const pricing = await getPlatformPlanPricing();
  const currentPlanKey = subscription ? normalizePlanKey(subscription.plan) : null;
  // Trial is granted at sign-up by the platform, not bought, so it is never offered here.
  const selectablePlans = pricing.filter((item) => SELECTABLE_PLAN_KEYS.includes(item.key as SubscriptionPlan));
  const plan = currentPlanKey ? getSubscriptionPlan(currentPlanKey) : null;
  const livePrice = subscription ? pricing.find((item) => item.key === currentPlanKey)?.priceLabel ?? plan?.price : plan?.price;
  const now = new Date();
  const expired = subscription ? subscription.currentPeriodEnd < now && subscription.status !== "CANCELED" : false;
  const status = expired ? "EXPIRED" : subscription?.status ?? "EXPIRED";
  const accessEnd = subscription?.currentPeriodEnd ?? now;
  const cycleStart = subscription?.currentPeriodStart ?? accessEnd;
  const cycleLengthMs = Math.max(1, accessEnd.getTime() - cycleStart.getTime());
  const elapsedRatio = Math.min(100, Math.max(0, ((now.getTime() - cycleStart.getTime()) / cycleLengthMs) * 100));
  const remainingRatio = Math.max(0, 100 - elapsedRatio);
  const daysLeft = Math.max(0, Math.ceil((accessEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const expiryBarClass = expired ? "bg-red-500" : daysLeft <= 7 ? "bg-amber-500" : "bg-brand-500";

  return <SessionProvider user={session.user}><AppShell restricted={expired}><div className="space-y-6"><PageHeader title="Subscription" description="Manage your VidyPOS portal access and monthly plan." />
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="size-5 text-brand-600" />Current plan</CardTitle></CardHeader><CardContent>
        {subscription && plan ? <><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-2xl font-semibold text-fg">{plan.name}</p><p className="mt-1 text-sm text-fg-muted">{plan.description}</p><p className="mt-3 text-lg font-medium text-fg">{livePrice}</p></div><Badge variant={status === "ACTIVE" || status === "TRIALING" ? "success" : "danger"}>{status === "TRIALING" ? "Free trial" : status.replace("_", " ")}</Badge></div><div className="mt-6 space-y-3">
          <div className="flex items-center justify-between gap-3 text-xs text-fg-secondary"><span>{expired ? "Billing ended" : "Billing cycle remaining"}</span><span>{expired ? "Expired" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}</span></div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-inset"><div className={`h-full rounded-full ${expiryBarClass}`} style={{ width: `${expired ? 100 : Math.max(6, remainingRatio)}%` }} /></div>
          <p className="text-xs text-fg-muted">{expired ? "This shop is blocked until an active renewal is paid for." : `Access remains active until ${accessEnd.toLocaleDateString("en-GH")}.`}</p>
        </div><div className="mt-6 grid gap-3 text-sm sm:grid-cols-2"><div className="flex items-center gap-2 text-fg-secondary"><CalendarDays className="size-4" />Access until {accessEnd.toLocaleDateString("en-GH")}</div><div className="flex items-center gap-2 text-fg-secondary"><ShieldCheck className="size-4" />{subscription.provider ? `Billing via ${subscription.provider}` : "Billing provider setup pending"}</div></div></> : <p className="text-sm text-fg-muted">No subscription is configured for this portal.</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{expired ? "Renew your subscription" : status === "TRIALING" ? "Choose your plan" : "Update your plan"}</CardTitle></CardHeader><CardContent>{subscription && plan ? <SubscriptionManager currentPlan={plan.key} plans={selectablePlans} paymentPhone={subscription.store.phone ?? ""} paymentEmail={account?.email ?? ""} /> : <p className="text-sm leading-6 text-fg-secondary">No subscription is configured for this portal.</p>}</CardContent></Card>
    </div>

    <PlatformFeatureChecklist plan={subscription?.plan ?? "STARTER"} />
  </div></AppShell></SessionProvider>;
}