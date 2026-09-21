import Link from "next/link";
import { Building2, Store, CalendarDays, FileWarning, CreditCard, Users, UserRound, ShoppingCart, BarChart3, Receipt, Repeat } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

const metrics = [
  { label: "Total registered businesses", href: "/platform/total-registered-businesses", icon: Building2 },
  { label: "Active businesses", href: "/platform/active-businesses", icon: Store },
  { label: "Trial businesses", href: "/platform/trial-businesses", icon: CalendarDays },
  { label: "Expired subscriptions", href: "/platform/expired-subscriptions", icon: FileWarning },
  { label: "Monthly recurring revenue", href: "/platform/monthly-recurring-revenue", icon: CreditCard },
  { label: "New registrations", href: "/platform/new-registrations", icon: Users },
  { label: "Active users", href: "/platform/active-users", icon: UserRound },
  { label: "Total transactions", href: "/platform/total-transactions", icon: ShoppingCart },
  { label: "Total sales processed", href: "/platform/total-sales-processed", icon: BarChart3 },
  { label: "Payment revenue", href: "/platform/payment-revenue", icon: Receipt },
  { label: "Subscription revenue", href: "/platform/subscription-revenue", icon: Repeat },
];

export function PlatformMetricNav() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className="block">
            <Card className="h-full transition hover:border-brand-600/70 hover:bg-muted/30">
              <CardContent className="flex items-center gap-3">
                <span className="rounded-xl border border-line bg-card p-2">
                  <Icon className="size-4 text-brand-600" />
                </span>
                <span className="text-sm font-semibold text-fg">{item.label}</span>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </section>
  );
}
