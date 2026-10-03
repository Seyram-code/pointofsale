import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

export function PlanUpgradeNotice({ message }: { message: string }) {
  return (
    <Card className="max-w-2xl border-accent-300 bg-accent-50/70 dark:border-accent-800 dark:bg-accent-900/10">
      <CardContent className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800 dark:bg-accent-900/40 dark:text-accent-200">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold text-fg">Upgrade to access this feature</h2>
          <p className="mt-1 text-sm leading-6 text-fg-secondary">{message}</p>
          <Link
            href="/subscription"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            View upgrade options
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}