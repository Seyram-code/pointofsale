"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center py-10 text-center">
        <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-red-50 text-danger dark:bg-red-950/40">
          <AlertTriangle className="size-6" />
        </span>
        <p className="text-base font-semibold text-fg">Could not load the dashboard</p>
        <p className="mt-1.5 max-w-sm text-sm text-fg-muted">
          The store figures could not be fetched. Check the database connection and try again.
        </p>
        <Button className="mt-5" variant="outline" onClick={reset} leftIcon={<RefreshCw className="size-4" />}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
