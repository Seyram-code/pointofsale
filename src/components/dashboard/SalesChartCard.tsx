import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { BarChart } from "@/components/charts/BarChart";
import { Money } from "@/components/ui/Money";
import { formatNumber } from "@/lib/utils/format";
import type { SalesTrendPoint } from "@/lib/services/dashboard.service";

export function SalesChartCard({ points }: { points: SalesTrendPoint[] }) {
  const total = points.reduce((sum, point) => sum + point.revenue, 0);

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
        <div>
          <CardTitle>Sales this week</CardTitle>
          <CardDescription>Revenue for the last 7 days</CardDescription>
        </div>
        <Money value={total} size="lg" />
      </CardHeader>
      <CardContent>
        <BarChart
          data={points.map((point) => ({
            label: point.label,
            value: point.revenue,
            secondary: `${formatNumber(point.transactions)} transaction${point.transactions === 1 ? "" : "s"}`,
          }))}
        />
      </CardContent>
    </Card>
  );
}
