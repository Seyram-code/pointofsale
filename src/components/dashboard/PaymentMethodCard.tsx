import { Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { DonutChart } from "@/components/charts/DonutChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils/format";
import type { PaymentBreakdownSlice } from "@/lib/services/dashboard.service";

const METHOD_COLORS: Record<string, string> = {
  CASH: "oklch(0.64 0.17 150)",
  MOMO: "oklch(0.74 0.16 85)",
  CARD_TERMINAL: "oklch(0.62 0.16 250)",
  BANK_TRANSFER: "oklch(0.58 0.14 300)",
  STORE_CREDIT: "oklch(0.68 0.12 200)",
  LOYALTY_POINTS: "oklch(0.7 0.13 30)",
  VOUCHER: "oklch(0.6 0.05 250)",
};

export function PaymentMethodCard({ slices }: { slices: PaymentBreakdownSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Payment methods</CardTitle>
          <CardDescription>How customers paid today</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {slices.length === 0 ? (
          <EmptyState
            icon={<Wallet className="size-6" />}
            title="No payments today"
            message="Cash, MoMo and card splits appear here as sales come in."
          />
        ) : (
          <DonutChart
            centerLabel="collected today"
            centerValue={formatCurrency(total, { compact: total >= 100_000 })}
            slices={slices.map((slice) => ({
              label: slice.label,
              value: slice.amount,
              color: METHOD_COLORS[slice.method] ?? "oklch(0.6 0.05 250)",
            }))}
          />
        )}
      </CardContent>
    </Card>
  );
}
