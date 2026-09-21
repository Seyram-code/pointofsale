import Link from "next/link";
import { ArrowRight, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Money } from "@/components/ui/Money";
import { formatDate } from "@/lib/utils/format";
import type { RecentTransaction } from "@/lib/services/dashboard.service";

const STATUS_VARIANT = {
  COMPLETED: "success",
  PARTIALLY_REFUNDED: "warning",
  REFUNDED: "warning",
  VOIDED: "danger",
  DRAFT: "neutral",
} as const;

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  MOMO: "MoMo",
  CARD_TERMINAL: "Card",
  BANK_TRANSFER: "Bank",
  STORE_CREDIT: "Credit",
  LOYALTY_POINTS: "Points",
  VOUCHER: "Voucher",
};

export function RecentTransactionsCard({ transactions }: { transactions: RecentTransaction[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
        <Link
          href="/sales"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          View all <ArrowRight className="size-4" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {transactions.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-6" />}
            title="No transactions yet"
            message="Completed sales will show up here in real time."
          />
        ) : (
          <ul className="divide-y divide-[var(--border-base)]">
            {transactions.map((transaction) => (
              <li key={transaction.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-medium text-fg">{transaction.receiptNumber}</span>
                    <Badge
                      size="sm"
                      variant={STATUS_VARIANT[transaction.status as keyof typeof STATUS_VARIANT] ?? "neutral"}
                    >
                      {transaction.status.replace(/_/g, " ").toLowerCase()}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-fg-muted">
                    {transaction.customerName ?? "Walk-in customer"} &middot; {transaction.itemCount} item
                    {transaction.itemCount === 1 ? "" : "s"} &middot; {transaction.cashierName}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Money value={transaction.total} className="block font-semibold" />
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {transaction.methods.map((method) => METHOD_LABELS[method] ?? method).join(", ") || "—"}
                    {transaction.completedAt ? ` · ${formatDate(transaction.completedAt, "time")}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
