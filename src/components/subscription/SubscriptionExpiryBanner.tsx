import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import type { SubscriptionStatusInfo } from "@/lib/services/subscription.service";

/**
 * Warns store users on the dashboard when their subscription has ended or is within
 * the warning window of ending. Renders nothing while the subscription is healthy.
 */
export function SubscriptionExpiryBanner({ subscription }: { subscription: SubscriptionStatusInfo }) {
  if (!subscription.expired && !subscription.expiringSoon) return null;

  const expired = subscription.expired;

  return (
    <div
      role="alert"
      className={`mb-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
        expired
          ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
          : "border-accent-300 bg-accent-100 dark:border-accent-800 dark:bg-accent-900/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
            expired ? "bg-danger/10 text-danger" : "bg-accent-500/20 text-accent-800 dark:text-accent-200"
          }`}
        >
          {expired ? <AlertTriangle className="size-4" aria-hidden /> : <CalendarClock className="size-4" aria-hidden />}
        </span>
        <div>
          <p className={`text-sm font-semibold ${expired ? "text-danger" : "text-fg"}`}>
            {expired
              ? "Your subscription has ended"
              : `Your subscription expires in ${subscription.daysLeft} ${subscription.daysLeft === 1 ? "day" : "days"}`}
          </p>
          <p className="mt-0.5 text-sm text-fg-secondary">
            {expired
              ? `Access was suspended on ${formatDate(subscription.currentPeriodEnd)}. Renew to restore your shop.`
              : `Renew before ${formatDate(subscription.currentPeriodEnd)} to avoid any interruption to your shop.`}
          </p>
        </div>
      </div>
      <Link
        href="/subscription"
        className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Renew now
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}