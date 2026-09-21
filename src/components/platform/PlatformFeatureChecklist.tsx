import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FEATURE_META, getPlanFeatureStatus, type FeatureKey } from "@/lib/config/platform-features";

export function PlatformFeatureChecklist({ plan }: { plan: string | null | undefined }) {
  const features: FeatureKey[] = [
    "multiBranch",
    "usageLimits",
    "notifications",
    "auditLogs",
    "backups",
    "offlinePos",
    "mobileOptimization",
    "advancedAnalytics",
    "platformBilling",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform features</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((feature) => {
            const enabled = getPlanFeatureStatus(plan, feature);
            const meta = FEATURE_META[feature];

            return (
              <div key={feature} className="flex items-start gap-3 rounded-xl border border-line bg-muted/20 p-3">
                <div className={`mt-0.5 flex size-6 items-center justify-center rounded-full ${enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-slate-500/10 text-slate-500"}`}>
                  {enabled ? <Check className="size-4" /> : <X className="size-4" />}
                </div>
                <div>
                  <div className="font-medium text-fg">{meta.label}</div>
                  <div className="text-xs text-fg-muted">{meta.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
